"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

class ProjectRename(BaseModel):
    name: str



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/projects/rename")
def rename_project(r: ProjectRename) -> ProjectRename:
    if not 3 <= len(r.name) <= 40:
        raise InvalidRequest("name must have 3 to 40 characters")
    return r
