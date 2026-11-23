"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class Poll(BaseModel):
    question: str = Field(min_length=5, max_length=120)
    options: list[str] = Field(min_length=2, max_length=6)
