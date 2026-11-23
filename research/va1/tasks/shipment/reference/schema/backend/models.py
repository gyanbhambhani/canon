"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class Shipment(BaseModel):
    weight_g: int = Field(ge=1, le=30000)
    length: int = Field(ge=1, le=200)
    width: int = Field(ge=1, le=100)
    height: int = Field(ge=1, le=100)

    @model_validator(mode="after")
    def size_limit(self) -> Self:
        # a computed rule over three fields: the schema cannot state it, so it is kept by hand here and in the frontend
        if self.length + 2 * (self.width + self.height) > 300:
            raise ValueError("length + 2 * (width + height) must be at most 300")
        return self
