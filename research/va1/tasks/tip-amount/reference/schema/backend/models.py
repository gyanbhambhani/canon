"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class Tip(BaseModel):
    amount: float = Field(ge=0.01, le=10000.0)
    percent: int = Field(ge=0, le=100)
