"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class Limits(BaseModel):
    daily: int = Field(ge=1, le=1000)
    monthly: int = Field(ge=1, le=31000)
