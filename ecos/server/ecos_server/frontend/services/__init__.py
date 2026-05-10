from .frontend import FrontendService

_frontend_service = None


def frontend_service():
    global _frontend_service
    if _frontend_service is None:
        _frontend_service = FrontendService()
    return _frontend_service


__all__ = ["FrontendService", "frontend_service"]
