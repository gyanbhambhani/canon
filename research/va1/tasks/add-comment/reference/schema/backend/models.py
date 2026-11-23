"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class Comment(BaseModel):
    # a non-blank body: at most 500 characters, with at least one character that is not space, tab, CR or LF
    body: str = Field(max_length=500, pattern=r"[^ \t\r\n]")
