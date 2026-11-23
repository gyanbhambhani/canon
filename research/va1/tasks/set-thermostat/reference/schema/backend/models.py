"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Setting(BaseModel):
    temperature: int = Field(ge=10, le=30)
    mode: Literal["eco", "comfort", "away"]
