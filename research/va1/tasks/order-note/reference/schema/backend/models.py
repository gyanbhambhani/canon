"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class OrderNote(BaseModel):
    note: str = Field(max_length=200)
    priority: int = Field(ge=0, le=9)
