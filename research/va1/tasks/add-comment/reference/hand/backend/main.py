"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Comment(BaseModel):
    body: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/comments")
def add_comment(comment: Comment) -> Comment:
    if not comment.body.strip() or len(comment.body) > 500:
        raise InvalidRequest("body must be present and at most 500 characters")
    return comment
