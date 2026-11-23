"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field

class UploadMeta(BaseModel):
    filename: str = Field(min_length=1, max_length=100)
    size_kb: int = Field(ge=1, le=10240)
    kind: Literal["png", "jpg", "pdf"]

