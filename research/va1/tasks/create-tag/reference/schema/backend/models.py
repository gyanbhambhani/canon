"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field

class TagDraft(BaseModel):
    label: str = Field(min_length=2, max_length=20)
    color: Literal["red", "green", "blue", "gray"]

