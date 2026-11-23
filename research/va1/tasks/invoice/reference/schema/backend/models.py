"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class Invoice(BaseModel):
    number: str = Field(min_length=1, max_length=20)
    subtotal: int = Field(ge=0)
    tax: int = Field(ge=0)
    shipping: int = Field(ge=0)
    total: int = Field(ge=0)

    @model_validator(mode="after")
    def total_is_sum(self) -> Self:
        # the schema cannot state a computed rule: kept by hand, here and in the frontend feature
        if self.subtotal + self.tax + self.shipping != self.total:
            raise ValueError("total must equal subtotal + tax + shipping")
        return self
