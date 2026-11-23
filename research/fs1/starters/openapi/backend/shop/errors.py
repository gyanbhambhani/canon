"""Error responses: {"error": {"kind": ...}}. 400 for a domain error, 422 for invalid input,
500 for anything unexpected."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """A domain error the client can handle, sent as 400."""

    def __init__(self, kind: str, **fields: object) -> None:
        super().__init__(kind)
        self.body = {"kind": kind, **fields}


class InvalidRequest(Exception):
    """A request that breaks a validation rule, sent as 422."""

    def __init__(self, rule: str) -> None:
        super().__init__(rule)
        self.rule = rule


def install_error_handlers(app: FastAPI) -> None:
    async def api_error(_: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, ApiError)
        return JSONResponse({"error": exc.body}, status_code=400)

    async def invalid(_: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, InvalidRequest):
            rule = exc.rule
        elif isinstance(exc, RequestValidationError):
            rule = "; ".join(
                f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}"
                for e in exc.errors()
            )
        else:
            rule = str(exc)
        body = {"error": {"kind": "ValidationError", "rule": rule}}
        return JSONResponse(body, status_code=422)

    async def internal(_: Request, exc: Exception) -> JSONResponse:
        logging.getLogger("shop").error("request failed", exc_info=exc)
        return JSONResponse({"error": {"kind": "InternalError"}}, status_code=500)

    app.add_exception_handler(ApiError, api_error)
    app.add_exception_handler(InvalidRequest, invalid)
    app.add_exception_handler(RequestValidationError, invalid)
    app.add_exception_handler(Exception, internal)
