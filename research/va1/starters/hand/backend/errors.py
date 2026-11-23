"""Error responses: {"error": {"kind": ...}}. 422 for invalid input, 500 for anything unexpected."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class InvalidRequest(Exception):
    """A request that breaks a validation rule, sent as 422."""

    def __init__(self, rule: str) -> None:
        super().__init__(rule)
        self.rule = rule


def install_error_handlers(app: FastAPI) -> None:
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
        logging.getLogger("forms").error("request failed", exc_info=exc)
        return JSONResponse({"error": {"kind": "InternalError"}}, status_code=500)

    app.add_exception_handler(InvalidRequest, invalid)
    app.add_exception_handler(RequestValidationError, invalid)
    app.add_exception_handler(Exception, internal)
