"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class RectangleRequest(BaseModel):
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    label: str = Field(max_length=20)

    @model_validator(mode="after")
    def area_max(self) -> Self:
        # a computed rule: the schema cannot state it, so it is kept by hand here and in the frontend
        if self.width * self.height > 10000:
            raise ValueError("the area must be at most 10000")
        return self


class Rectangle(BaseModel):
    width: int
    height: int
    label: str
    area: int
