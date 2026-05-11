#!/usr/bin/env python

from functools import lru_cache
from pathlib import Path
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

from ecos_server.ecc.schemas import ECCRequest, ECCResponse

from ..services import frontend_service

fe_serv = frontend_service()

router = APIRouter(prefix="/api/frontend/workspace", tags=["frontend-workspace"])

SURFER_APP_BASE = "https://app.surfer-project.org"
SURFER_ASSET_TYPES = {
    "integration.js": "application/javascript; charset=utf-8",
    "surfer.js": "application/javascript; charset=utf-8",
    "surfer_bg.wasm": "application/wasm",
    "manifest.json": "application/json; charset=utf-8",
    "sw.js": "application/javascript; charset=utf-8",
}


@lru_cache(maxsize=16)
def _fetch_surfer_asset(asset: str) -> bytes:
    url = f"{SURFER_APP_BASE}/{asset}"
    with urlopen(url, timeout=20) as response:
        return response.read()


@lru_cache(maxsize=1)
def _surfer_html() -> bytes:
    text = _fetch_surfer_asset("").decode("utf-8")
    text = text.replace(
        "navigator.serviceWorker.register('sw.js');",
        "console.debug('Surfer service worker disabled inside ECOS Studio');",
    )
    return text.encode("utf-8")


def _surfer_response(body: bytes, media_type: str) -> Response:
    return Response(
        content=body,
        media_type=media_type,
        headers={
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cache-Control": "public, max-age=600",
        },
    )


@router.get("/health")
async def health_check():
    """Health check endpoint for frontend design workspace APIs."""
    return {"status": "ok"}


@router.get("/waveform/surfer")
@router.get("/waveform/surfer/")
def waveform_surfer():
    """Serve the Surfer web viewer through the local API origin."""
    return _surfer_response(_surfer_html(), "text/html; charset=utf-8")


@router.get("/waveform/surfer/{asset}")
def waveform_surfer_asset(asset: str):
    """Proxy Surfer web assets through the local API origin."""
    if asset not in SURFER_ASSET_TYPES:
        raise HTTPException(status_code=404, detail=f"unknown Surfer asset: {asset}")
    try:
        return _surfer_response(_fetch_surfer_asset(asset), SURFER_ASSET_TYPES[asset])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"failed to fetch Surfer asset: {asset}") from exc


@router.get("/waveform/file")
@router.head("/waveform/file")
@router.get("/waveform/file/{filename}")
@router.head("/waveform/file/{filename}")
def waveform_file(filename: str = "", path: str = Query(...)):
    """Serve a waveform file from the currently loaded frontend workspace."""
    _ = filename
    try:
        resolved = fe_serv.resolve_waveform_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"waveform file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(
        resolved,
        media_type="application/octet-stream",
        filename=Path(resolved).name,
        headers={
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Resource-Policy": "same-origin",
        },
    )


@router.post("/create_workspace", response_model=ECCResponse)
def create_workspace(request: ECCRequest):
    """Create a new frontend design workspace."""
    return fe_serv.dispatch(request)


@router.post("/load_workspace", response_model=ECCResponse)
def load_workspace(request: ECCRequest):
    """Open an existing frontend design workspace."""
    return fe_serv.dispatch(request)


@router.post("/delete_workspace", response_model=ECCResponse)
def delete_workspace(request: ECCRequest):
    """Delete the current frontend design workspace."""
    return fe_serv.dispatch(request)


@router.post("/rtl2gds", response_model=ECCResponse)
def run_all(request: ECCRequest):
    """Run the full frontend flow. The command name is kept for GUI compatibility."""
    return fe_serv.dispatch(request)


@router.post("/run_step", response_model=ECCResponse)
def run_step(request: ECCRequest):
    """Run one frontend flow step."""
    return fe_serv.dispatch(request)


@router.post("/get_info", response_model=ECCResponse)
def get_info(request: ECCRequest):
    """Get information for a frontend flow step."""
    return fe_serv.dispatch(request)


@router.post("/get_home_page", response_model=ECCResponse)
def get_home_page(request: ECCRequest):
    """Get the frontend workspace home page index."""
    return fe_serv.dispatch(request)
