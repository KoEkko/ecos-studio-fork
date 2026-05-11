#!/usr/bin/env python
from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from ecos_server.ecc.schemas import CMDEnum, ECCRequest, ECCResponse, ResponseEnum
from ecos_server.ecc.schemas.info import InfoEnum
from ecos_server.ecc.sse.notify_service import NotifyService

logger = logging.getLogger(__name__)


def _summarize_request(data: object) -> dict:
    if not isinstance(data, dict):
        return {}
    summary = {}
    for key in ("directory", "step", "id", "rerun", "sim_test_suite", "sim_cpu_test_mode"):
        if key in data:
            summary[key] = data[key]
    if "sim_cpu_test_cases" in data:
        summary["sim_cpu_test_cases_count"] = len(_normalize_str_list(data["sim_cpu_test_cases"]))
    if "parameters" in data:
        summary["parameters_keys"] = len(data["parameters"])
    if "rtl_list" in data:
        rtl = data["rtl_list"]
        summary["rtl_count"] = len(rtl.splitlines() if isinstance(rtl, str) else rtl)
    return summary


def _iter_path_values(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, (list, tuple, set)):
        values: list[str] = []
        for item in value:
            values.extend(_iter_path_values(item))
        return values
    return [str(value)]


def _add_fe_root_candidates(candidates: list[Path], root: Path) -> None:
    candidates.append(root)
    candidates.append(root / "ecc-fe")
    if root.name == "fecompiler":
        candidates.append(root.parent)
    for parent in root.parents:
        candidates.append(parent)
        candidates.append(parent / "ecc-fe")


def _ensure_fecompiler_importable(*hints: Any) -> None:
    """Add the ecc-fe submodule to sys.path in source-tree development."""
    candidates: list[Path] = []
    env_root = os.environ.get("ECOS_FE_COMPILER_ROOT", "").strip()
    if env_root:
        _add_fe_root_candidates(candidates, Path(env_root).expanduser())

    for key in ("ECOS_STUDIO_ROOT", "BUILD_WORKSPACE_DIRECTORY", "PWD", "OLDPWD"):
        env_value = os.environ.get(key, "").strip()
        if env_value:
            _add_fe_root_candidates(candidates, Path(env_value).expanduser())

    for hint in hints:
        for item in _iter_path_values(hint):
            if item:
                _add_fe_root_candidates(candidates, Path(item).expanduser())

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidates.append(parent / "ecc-fe")

    for candidate in candidates:
        if (candidate / "fecompiler").is_dir():
            path = str(candidate)
            if path not in sys.path:
                sys.path.insert(0, path)
            return


def _normalize_str_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = value.splitlines()
    else:
        items = [value]
    result = []
    seen = set()
    for item in items:
        text = str(item).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _resolve_path(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return str(Path(text).expanduser().resolve())


def _json_read(path: Any) -> Any:
    text = str(path or "").strip()
    if not text or not os.path.exists(text):
        return None
    with open(text, encoding="utf-8") as f:
        return json.load(f)


def _path_item(path: Any, label: str = "") -> dict[str, str]:
    text = str(path or "").strip()
    if not text:
        return {}
    return {"label": label or Path(text).name, "path": text}


def _existing_path_item(path: Any, label: str = "") -> dict[str, str]:
    item = _path_item(path, label)
    if item and os.path.exists(item["path"]):
        return item
    return {}


def _is_frontend_workspace(workspace: dict[str, Any]) -> bool:
    """Return True only for workspaces that look like an ecc-fe workspace."""
    params_path = workspace.get("parameters_path", "")
    try:
        with open(params_path, encoding="utf-8") as f:
            parameters = json.load(f)
    except Exception:
        parameters = {}

    design_tool = str(
        parameters.get("Design Tool")
        or parameters.get("design_tool")
        or parameters.get("ECOS Design Tool")
        or ""
    ).strip().lower()
    if design_tool == "frontend":
        return True

    return any(
        workspace.get(field)
        for field in (
            "cpu_filelist",
            "soc_filelist",
            "testbench",
            "sim_cpp_sources",
            "sim_program_names",
        )
    )


class FrontendService:
    _WS_LOGGER_NAME = "ecos_server.frontend"
    _COMMANDS = frozenset(
        {
            CMDEnum.create_workspace.value,
            CMDEnum.load_workspace.value,
            CMDEnum.delete_workspace.value,
            CMDEnum.rtl2gds.value,
            CMDEnum.run_step.value,
            CMDEnum.get_info.value,
            CMDEnum.home_page.value,
        }
    )

    def __init__(self):
        self.workspace: dict[str, Any] | None = None
        self.engine_flow = None
        self._workspace_log_handler = None
        self.notify = NotifyService()

    def dispatch(self, request: ECCRequest) -> ECCResponse:
        cmd = request.cmd
        if cmd not in self._COMMANDS:
            return ECCResponse(
                cmd=cmd,
                response=ResponseEnum.error.value,
                data={},
                message=[f"unknown frontend command: {cmd}"],
            )

        handler = self.rtl2gds if cmd == CMDEnum.rtl2gds.value else getattr(self, cmd)
        logger.info("[FE_CMD:start] cmd=%s %s", cmd, _summarize_request(request.data))
        start = time.time()
        try:
            response = handler(request)
        except Exception:
            elapsed_ms = (time.time() - start) * 1000
            logger.exception("[FE_CMD:error] cmd=%s elapsed=%.0fms", cmd, elapsed_ms)
            raise

        elapsed_ms = (time.time() - start) * 1000
        logger.info(
            "[FE_CMD:done] cmd=%s result=%s elapsed=%.0fms",
            cmd,
            getattr(response, "response", type(response).__name__),
            elapsed_ms,
        )
        return response

    def _attach_workspace_log(self, workspace_dir: str) -> None:
        self._detach_workspace_log()
        log_dir = os.path.join(os.path.abspath(workspace_dir), "log")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "frontend-server.log")
        handler = RotatingFileHandler(log_path, maxBytes=10 * 1024 * 1024, backupCount=5)
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        logging.getLogger(self._WS_LOGGER_NAME).addHandler(handler)
        self._workspace_log_handler = handler
        logger.info("Frontend API logs -> %s", log_path)

    def _detach_workspace_log(self) -> None:
        if self._workspace_log_handler:
            logging.getLogger(self._WS_LOGGER_NAME).removeHandler(self._workspace_log_handler)
            self._workspace_log_handler.close()
            self._workspace_log_handler = None

    def _build_flow(self) -> None:
        _ensure_fecompiler_importable()
        from fecompiler.engine.flow import EngineFlow

        engine_flow = EngineFlow(workspace=self.workspace)
        if not engine_flow.has_init():
            engine_flow.init_default_steps()
            engine_flow.load()
        engine_flow.create_step_workspaces()
        self.engine_flow = engine_flow

    def _workspace_dir(self) -> str:
        if not self.workspace:
            return ""
        return str(self.workspace.get("directory", ""))

    def _workspace_exists(self) -> bool:
        directory = self._workspace_dir()
        return bool(directory and os.path.exists(directory))

    def resolve_waveform_file(self, path: Any) -> str:
        """Resolve a waveform file inside the current frontend workspace."""
        if not self._workspace_exists():
            raise ValueError(f"frontend workspace not exist: {self._workspace_dir()}")

        workspace_dir = Path(self._workspace_dir()).expanduser().resolve()
        wave_path = Path(str(path or "")).expanduser().resolve()
        if wave_path.suffix.lower() not in {".vcd", ".fst", ".ghw"}:
            raise ValueError(f"unsupported waveform file type: {wave_path.suffix}")
        if not wave_path.is_file():
            raise FileNotFoundError(str(wave_path))
        if not wave_path.is_relative_to(workspace_dir):
            raise ValueError("waveform file is outside current frontend workspace")
        return str(wave_path)

    def create_workspace(self, request: ECCRequest) -> ECCResponse:
        data = request.data
        try:
            _ensure_fecompiler_importable(
                data.get("cpu_filelist", ""),
                data.get("soc_filelist", ""),
                data.get("testbench", ""),
                data.get("sim_cpp_sources", []),
                data.get("sim_programs_dir", ""),
                data.get("sim_soc_root", ""),
                data.get("sim_build_test_script", ""),
            )
            from fecompiler.data.workspace import CreateWorkspaceData, create_workspace

            parameters = dict(data.get("parameters", {}))
            parameters.setdefault("Design Tool", "frontend")
            if data.get("soc_variant"):
                parameters["soc_variant"] = data.get("soc_variant")
            spec = CreateWorkspaceData(
                directory=data.get("directory", ""),
                parameters=parameters,
                origin_def=data.get("origin_def", ""),
                origin_verilog=data.get("origin_verilog", ""),
                filelist=data.get("filelist", ""),
                cpu_filelist=data.get("cpu_filelist", ""),
                soc_filelist=data.get("soc_filelist", ""),
                testbench=data.get("testbench", ""),
                sim_cpp_sources=_normalize_str_list(data.get("sim_cpp_sources", [])),
                sim_cflags=_normalize_str_list(data.get("sim_cflags", [])),
                sim_ldflags=_normalize_str_list(data.get("sim_ldflags", [])),
                sim_run_args=_normalize_str_list(data.get("sim_run_args", [])),
                sim_images=_normalize_str_list(data.get("sim_images", [])),
                sim_all_tests=_normalize_bool(data.get("sim_all_tests", False)),
                sim_tests_dir=data.get("sim_tests_dir", ""),
                sim_build_all_programs=_normalize_bool(data.get("sim_build_all_programs", False)),
                sim_program_names=_normalize_str_list(data.get("sim_program_names", [])),
                sim_program_sources=_normalize_str_list(data.get("sim_program_sources", [])),
                sim_programs_dir=data.get("sim_programs_dir", ""),
                sim_tests_out_dir=data.get("sim_tests_out_dir", ""),
                sim_soc_root=data.get("sim_soc_root", ""),
                sim_build_test_script=data.get("sim_build_test_script", ""),
                rtl_list=_normalize_str_list(data.get("rtl_list", [])),
            )
            workspace = create_workspace(spec)
        except Exception as e:
            logger.exception("frontend create_workspace failed")
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data={},
                message=[f"create frontend workspace failed: {e}"],
            )

        if workspace is None:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.failed.value,
                data={},
                message=[f"create frontend workspace failed: {data.get('directory', '')}"],
            )

        self.workspace = workspace
        self._build_flow()
        self.notify.set_workspace(workspace["directory"])
        self._attach_workspace_log(workspace["directory"])
        response_data = {"directory": workspace["directory"], "workspace_id": workspace["directory"]}
        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.success.value,
            data=response_data,
            message=[f"create frontend workspace success: {workspace['directory']}"],
        )

    def load_workspace(self, request: ECCRequest) -> ECCResponse:
        directory = request.data.get("directory", "")
        try:
            _ensure_fecompiler_importable(directory)
            from fecompiler.data.workspace import load_workspace

            workspace = load_workspace(directory)
        except Exception as e:
            logger.exception("frontend load_workspace failed")
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.failed.value,
                data={},
                message=[f"load frontend workspace failed: {directory}, error info is {e}"],
            )

        if workspace is None:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.failed.value,
                data={},
                message=[f"load frontend workspace failed: {directory}"],
            )

        if not _is_frontend_workspace(workspace):
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.failed.value,
                data={},
                message=[f"not a frontend workspace: {directory}"],
            )

        self.workspace = workspace
        self._build_flow()
        self.notify.set_workspace(workspace["directory"])
        self._attach_workspace_log(workspace["directory"])
        response_data = {"directory": workspace["directory"], "workspace_id": workspace["directory"]}
        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.success.value,
            data=response_data,
            message=[f"load frontend workspace success: {workspace['directory']}"],
        )

    def delete_workspace(self, request: ECCRequest) -> ECCResponse:
        directory = request.data.get("directory", "")
        if not self.workspace or self._workspace_dir() != directory or not os.path.exists(directory):
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data={},
                message=[f"frontend workspace not exist: {directory}"],
            )

        self._detach_workspace_log()
        self.engine_flow = None
        self.workspace = None
        self.notify.clear_workspace()
        try:
            shutil.rmtree(directory)
        except Exception:
            logger.exception("frontend delete_workspace failed")

        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.success.value,
            data={"directory": directory},
            message=[f"delete frontend workspace success: {directory}"],
        )

    def rtl2gds(self, request: ECCRequest) -> ECCResponse:
        data = request.data
        response_data = {"rerun": data.get("rerun", False)}
        if not self._workspace_exists():
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"frontend workspace not exist: {self._workspace_dir()}"],
            )
        if self.engine_flow is None:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"frontend flow not exist: {self._workspace_dir()}"],
            )

        failed_step = None
        try:
            if data.get("rerun", False):
                self.engine_flow.clear_states()

            for workspace_step in self.engine_flow.workspace_steps:
                step_response = self.run_step(
                    ECCRequest(
                        cmd=CMDEnum.run_step.value,
                        data={"step": workspace_step.name, "rerun": data.get("rerun", False)},
                    )
                )
                log_file = workspace_step.log.get("file", "")
                self.notify.notify_step(
                    step=workspace_step.name,
                    step_path=self.workspace["flow_path"],
                    home_page=self.workspace["home_path"],
                    log_file=os.path.abspath(log_file) if log_file else "",
                )
                self.notify.notify_subflow(
                    step=workspace_step.name,
                    subflow_path=workspace_step.subflow.get("path", ""),
                    home_page=self.workspace["home_path"],
                )
                if step_response.response != ResponseEnum.success.value:
                    failed_step = workspace_step.name
                    break
        except Exception as e:
            logger.exception("frontend run_all failed")
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"run frontend flow failed: {e}"],
            )

        if failed_step is None:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.success.value,
                data=response_data,
                message=[f"run frontend flow success: {self._workspace_dir()}"],
            )
        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.failed.value,
            data=response_data,
            message=[f"run frontend flow failed in step: {failed_step}"],
        )

    def run_step(self, request: ECCRequest) -> ECCResponse:
        _ensure_fecompiler_importable()
        from fecompiler.data.step import StateEnum

        data = request.data
        step = data.get("step", "")
        response_data = {"step": step, "state": StateEnum.Unstart.value}

        if not self._workspace_exists():
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"frontend workspace not exist: {self._workspace_dir()}"],
            )

        try:
            force_rerun = False
            if step == "sim":
                suite_name = str(data.get("sim_test_suite", "") or "").strip()
                self._apply_sim_test_suite(
                    suite_name,
                    data.get("sim_cpu_test_mode", "all"),
                    data.get("sim_cpu_test_cases", []),
                )
                # Selecting a simulation suite is an explicit "run tests now" action.
                # Force rerun for SIM to avoid returning cached Success immediately.
                force_rerun = bool(suite_name and suite_name.lower() != "default")
            state = self.engine_flow.run_step(step, bool(data.get("rerun", False) or force_rerun))
        except Exception:
            state = StateEnum.Incomplete
            logger.exception("frontend run_step failed")

        response_data["state"] = state.value
        if state == StateEnum.Success:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.success.value,
                data=response_data,
                message=[f"run frontend step {step} success: {self._workspace_dir()}"],
            )
        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.failed.value,
            data=response_data,
            message=[f"run frontend step {step} failed with state {state.value}: {self._workspace_dir()}"],
        )

    def _apply_sim_test_suite(
        self,
        suite: Any,
        cpu_test_mode: Any = "all",
        cpu_test_cases: Any = None,
    ) -> None:
        suite_name = str(suite or "").strip()
        if not suite_name or suite_name == "default":
            return
        if not self.workspace:
            return

        if suite_name == "cpu_tests":
            mode = str(cpu_test_mode or "all").strip().lower()
            cases = _normalize_str_list(cpu_test_cases)
            if mode not in {"all", "selected"}:
                raise ValueError(f"unknown CPU Tests mode: {mode}")
            if mode == "selected" and not cases:
                raise ValueError("select at least one CPU test case")
            if mode == "selected":
                self._validate_cpu_test_cases(cases)

            updates = {
                "sim_all_tests": False,
                "sim_images": [],
                "sim_build_all_programs": mode == "all",
                "sim_program_names": [] if mode == "all" else cases,
                "sim_run_args": self._default_cpu_tests_run_args(),
            }
        elif suite_name == "rtthread":
            updates = {
                "sim_all_tests": False,
                "sim_images": [],
                "sim_build_all_programs": False,
                "sim_program_names": ["rtthread"],
                "sim_run_args": ["--max-cycles", "10000000", "--wave", "/dev/null"],
            }
        else:
            raise ValueError(f"unknown frontend sim test suite: {suite_name}")

        self._update_workspace_parameters(updates)

    def _validate_cpu_test_cases(self, cases: list[str]) -> None:
        invalid_names = [
            name for name in cases
            if not name or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for char in name)
        ]
        if invalid_names:
            raise ValueError(f"invalid CPU test case name: {', '.join(invalid_names)}")

        programs_dir = _resolve_path(self.workspace.get("sim_programs_dir", "")) if self.workspace else ""
        if not programs_dir:
            return

        missing = [
            name for name in cases
            if not (Path(programs_dir) / f"{name}.c").is_file()
        ]
        if missing:
            raise ValueError(f"CPU test case not found: {', '.join(missing)}")

    def _default_cpu_tests_run_args(self) -> list[str]:
        soc_root = self._workspace_soc_root()
        if not soc_root:
            return ["--max-cycles", "50000000"]
        return [
            "--max-cycles",
            "50000000",
            "--diff",
            "--ref",
            str(soc_root / "tools" / "riscv32-spike-so"),
            "--diff-image-offset",
            "0x100",
            "--diff-reset-vector",
            "0x80000000",
        ]

    def _workspace_soc_root(self) -> Path | None:
        if not self.workspace:
            return None
        explicit = _resolve_path(self.workspace.get("sim_soc_root", ""))
        if explicit and Path(explicit).exists():
            return Path(explicit)
        soc_filelist = _resolve_path(self.workspace.get("soc_filelist", ""))
        if soc_filelist and Path(soc_filelist).exists():
            return Path(soc_filelist).parent
        return None

    def _update_workspace_parameters(self, updates: dict[str, Any]) -> None:
        if not self.workspace:
            return
        params_path = self.workspace.get("parameters_path", "")
        with open(params_path, encoding="utf-8") as f:
            parameters = json.load(f)

        parameters.update(updates)

        with open(params_path, "w", encoding="utf-8") as f:
            json.dump(parameters, f, indent=2, ensure_ascii=False)

        self.workspace.update(updates)

    def get_info(self, request: ECCRequest) -> ECCResponse:
        data = request.data
        step_name = data.get("step", "")
        info_id = data.get("id", "")
        response_data = {"step": step_name, "id": info_id, "info": {}}

        if not self._workspace_exists():
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"frontend workspace not exist: {self._workspace_dir()}"],
            )

        try:
            step = self.engine_flow.get_workspace_step(step_name)
            if step is None:
                return ECCResponse(
                    cmd=request.cmd,
                    response=ResponseEnum.warning.value,
                    data=response_data,
                    message=[f"no frontend step found: {step_name}"],
                )
            info = self._build_step_info(step, str(info_id))
            if not info:
                return ECCResponse(
                    cmd=request.cmd,
                    response=ResponseEnum.warning.value,
                    data=response_data,
                    message=[f"no frontend information for step {step_name}: {self._workspace_dir()}"],
                )
            response_data["info"] = info
        except Exception as e:
            logger.exception("frontend get_info failed")
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data=response_data,
                message=[f"get frontend information error for step {step_name}: {e}"],
            )

        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.success.value,
            data=response_data,
            message=[f"get frontend information success: {step_name} - {info_id}"],
        )

    def _build_step_info(self, step, info_id: str) -> dict:
        if info_id == InfoEnum.subflow.value:
            return {"path": step.subflow.get("path", "")}
        if info_id == InfoEnum.frontend_detail.value:
            return self._build_frontend_step_detail(step)
        if info_id == InfoEnum.config.value:
            config_path = step.config.get("flow", "")
            return {"config": config_path} if config_path and os.path.exists(config_path) else {}
        if info_id == InfoEnum.checklist.value:
            path = step.checklist.get("path", "")
            return {"checklist": {"path": path, "info": []}} if path and os.path.exists(path) else {}
        if info_id in {InfoEnum.analysis.value, InfoEnum.metrics.value}:
            metrics = step.analysis.get("metrics", "")
            statis = step.analysis.get("statis_csv", "")
            info = {}
            if metrics and os.path.exists(metrics):
                info["metrics"] = {"path": metrics, "info": []}
            if statis and os.path.exists(statis):
                info["statistics"] = {"path": statis, "info": []}
            return info
        if info_id == InfoEnum.layout.value:
            image = step.output.get("image", "")
            json_path = step.output.get("json", "")
            info = {}
            if image and os.path.exists(image):
                info["image"] = image
            if json_path and os.path.exists(json_path):
                info["json"] = json_path
            return info
        return {}

    def _build_frontend_step_detail(self, step) -> dict:
        flow_step = self.engine_flow.get_step(step.name, step.tool) if self.engine_flow else None
        state = str((flow_step or {}).get("state", "Unstart"))
        runtime = str((flow_step or {}).get("runtime", ""))
        peak_memory = (flow_step or {}).get("peak memory (mb)", 0)
        report_path = step.report.get("step", "")
        step_log_path = step.log.get("file", "")
        report_log_path = str(Path(step.report.get("dir", "")) / "log.txt")

        detail: dict[str, Any] = {
            "step": step.name,
            "tool": step.tool,
            "state": state,
            "runtime": runtime,
            "peak_memory_mb": peak_memory,
            "summary": self._build_frontend_step_summary(step, state, runtime),
            "logs": self._build_frontend_step_logs(step_log_path, report_log_path),
            "reports": self._build_frontend_step_reports(step),
            "artifacts": self._build_frontend_step_artifacts(step),
        }

        if step.name == "sim":
            cases = self._build_frontend_sim_cases(step)
            detail["cases"] = cases
            total = len(cases)
            passed = len([case for case in cases if case.get("ok") is True])
            failed = len([case for case in cases if case.get("ok") is False])
            detail["summary"].update(
                {
                    "total_cases": total,
                    "passed_cases": passed,
                    "failed_cases": failed,
                    "run_id": self._sim_run_id(step),
                    "test_suite": self._sim_suite_label(cases),
                    "cpu_test_mode": self._sim_cpu_test_mode(cases),
                }
            )
        return detail

    def _build_frontend_step_summary(self, step, state: str, runtime: str) -> dict[str, Any]:
        report = _json_read(step.report.get("step", ""))
        summary: dict[str, Any] = {
            "status": state,
            "runtime": runtime,
        }
        if isinstance(report, dict):
            summary["report"] = report
        return summary

    def _build_frontend_step_logs(self, step_log_path: str, report_log_path: str) -> list[dict[str, str]]:
        logs: list[dict[str, str]] = []
        for item in (
            _existing_path_item(step_log_path, "Step log"),
            _existing_path_item(report_log_path, "Tool log"),
        ):
            if item and item["path"] not in {log["path"] for log in logs}:
                logs.append(item)
        return logs

    def _build_frontend_step_reports(self, step) -> list[dict[str, str]]:
        reports: list[dict[str, str]] = []
        report_dir = Path(step.report.get("dir", ""))
        for item in (
            _existing_path_item(step.report.get("step", ""), "Step report"),
            _existing_path_item(report_dir / "cases.json", "Simulation cases"),
            _existing_path_item(report_dir / "build_programs.log.txt", "Build programs log"),
        ):
            if item:
                reports.append(item)
        return reports

    def _build_frontend_step_artifacts(self, step) -> list[dict[str, str]]:
        artifacts: list[dict[str, str]] = []
        seen_paths: set[str] = set()

        def _append_item(item: dict[str, str]) -> None:
            path = str(item.get("path", "")).strip() if item else ""
            if not path or path in seen_paths:
                return
            seen_paths.add(path)
            artifacts.append(item)

        for label, path in (
            ("Output JSON", step.output.get("json", "")),
            ("Prepared inputs", Path(step.output.get("dir", "")) / "prepared_inputs.json"),
            ("Merged filelist", Path(step.output.get("dir", "")) / "merged_rtl.f"),
            ("Simulation binary", Path(step.output.get("dir", "")) / f"{self.workspace.get('design', '')}_sim" if self.workspace else ""),
        ):
            item = _existing_path_item(path, label)
            if item:
                _append_item(item)

        if str(step.name).strip().lower() == "prepare":
            for item in self._build_prepare_cpu_source_artifacts(step):
                _append_item(item)

        return artifacts

    def _build_prepare_cpu_source_artifacts(self, step) -> list[dict[str, str]]:
        if not self.workspace:
            return []

        cpu_filelist = _resolve_path(self.workspace.get("cpu_filelist", ""))
        if not cpu_filelist:
            return []

        cpu_sources = self._collect_cpu_filelist_sources(cpu_filelist)
        if not cpu_sources:
            return []

        cpu_root = Path(cpu_filelist).expanduser().resolve().parent
        artifacts: list[dict[str, str]] = []

        for src in cpu_sources:
            rel = self._cpu_source_relative_path(src, cpu_root)
            artifacts.append(
                {
                    "label": f"CPU RTL · {rel}",
                    "path": str(src),
                }
            )

        return artifacts

    def _collect_cpu_filelist_sources(self, cpu_filelist: str) -> list[Path]:
        filelist_path = Path(cpu_filelist).expanduser().resolve()
        if not filelist_path.is_file():
            return []

        try:
            _ensure_fecompiler_importable(filelist_path)
            from fecompiler.tools.prepare.runner import PrepareStep

            parsed = PrepareStep._parse_sv_filelist(str(filelist_path))
            raw_files = parsed.get("rtl_files", []) if isinstance(parsed, dict) else []
        except Exception:
            logger.exception("failed to parse CPU filelist for prepare artifacts: %s", filelist_path)
            return []

        collected: list[Path] = []
        seen: set[str] = set()
        for raw in raw_files:
            try:
                source_path = Path(str(raw)).expanduser().resolve()
            except Exception:
                continue
            if source_path.suffix.lower() not in {".v", ".sv", ".vh", ".svh"}:
                continue
            if not source_path.is_file():
                continue
            key = str(source_path)
            if key in seen:
                continue
            seen.add(key)
            collected.append(source_path)

        return collected

    @staticmethod
    def _cpu_source_relative_path(source: Path, cpu_root: Path) -> str:
        try:
            return source.relative_to(cpu_root).as_posix()
        except ValueError:
            return source.name

    def _build_frontend_sim_cases(self, step) -> list[dict[str, Any]]:
        cases_json = Path(step.report.get("dir", "")) / "cases.json"
        data = _json_read(cases_json)
        raw_cases = data.get("cases", []) if isinstance(data, dict) else []
        if not isinstance(raw_cases, list):
            return []

        cases: list[dict[str, Any]] = []
        for raw_case in raw_cases:
            if not isinstance(raw_case, dict):
                continue
            cases.append(
                {
                    "name": str(raw_case.get("name", "")),
                    "ok": bool(raw_case.get("ok", False)),
                    "returncode": raw_case.get("returncode"),
                    "image": str(raw_case.get("image", "")),
                    "log": str(raw_case.get("log") or raw_case.get("latest_log") or ""),
                    "report_log": str(raw_case.get("report_log", "")),
                    "run_log": str(raw_case.get("run_log", "")),
                    "wave": str(raw_case.get("wave", "")),
                    "run_id": str(raw_case.get("run_id", "")),
                }
            )
        return cases

    def _sim_run_id(self, step) -> str:
        data = _json_read(Path(step.report.get("dir", "")) / "cases.json")
        return str(data.get("run_id", "")) if isinstance(data, dict) else ""

    def _sim_suite_label(self, cases: list[dict[str, Any]] | None = None) -> str:
        case_names = [str(case.get("name", "")) for case in (cases or [])]
        if case_names:
            return "RT-Thread" if case_names == ["rtthread.soc"] else "CPU Tests"
        if not self.workspace:
            return ""
        names = _normalize_str_list(self.workspace.get("sim_program_names", []))
        if names == ["rtthread"]:
            return "RT-Thread"
        if self.workspace.get("sim_build_all_programs") or names:
            return "CPU Tests"
        return "Default"

    def _sim_cpu_test_mode(self, cases: list[dict[str, Any]] | None = None) -> str:
        case_names = [str(case.get("name", "")) for case in (cases or [])]
        if case_names:
            if case_names == ["rtthread.soc"]:
                return ""
            return "all" if len(case_names) >= self._cpu_test_program_count() else "selected"
        if not self.workspace:
            return ""
        if self.workspace.get("sim_build_all_programs"):
            return "all"
        if _normalize_str_list(self.workspace.get("sim_program_names", [])):
            return "selected"
        return ""

    def _cpu_test_program_count(self) -> int:
        if not self.workspace:
            return 0
        programs_dir = _resolve_path(self.workspace.get("sim_programs_dir", ""))
        if not programs_dir:
            return 0
        path = Path(programs_dir)
        return len(list(path.glob("*.c"))) if path.is_dir() else 0

    def home_page(self, request: ECCRequest) -> ECCResponse:
        if not self.workspace:
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.error.value,
                data={},
                message=["frontend workspace not loaded"],
            )

        home_path = str(self.workspace.get("home_path", ""))
        if home_path and os.path.exists(home_path):
            return ECCResponse(
                cmd=request.cmd,
                response=ResponseEnum.success.value,
                data={"path": home_path},
                message=[f"get frontend home page success: {home_path}"],
            )
        return ECCResponse(
            cmd=request.cmd,
            response=ResponseEnum.failed.value,
            data={},
            message=[f"get frontend home page failed: {home_path}"],
        )
