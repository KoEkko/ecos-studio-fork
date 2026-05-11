#!/usr/bin/env python

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ecos_server.ecc.schemas import ECCRequest, ECCResponse

from ..services import frontend_service

fe_serv = frontend_service()

router = APIRouter(prefix="/api/frontend/workspace", tags=["frontend-workspace"])


@router.get("/health")
async def health_check():
    """Health check endpoint for frontend design workspace APIs."""
    return {"status": "ok"}


@router.get("/waveform/file")
def waveform_file(path: str = Query(...)):
    """Serve a waveform file from the currently loaded frontend workspace."""
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
