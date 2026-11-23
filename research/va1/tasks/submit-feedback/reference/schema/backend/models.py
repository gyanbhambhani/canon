"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class Feedback(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    message: str = Field(min_length=10, max_length=1000)
    score: int = Field(ge=0, le=10)
