"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class CouponRequest(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    subtotal: int = Field(ge=1)
    discount: int = Field(ge=0)

    @model_validator(mode="after")
    def discount_within_subtotal(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if self.discount > self.subtotal:
            raise ValueError("discount must be at most subtotal")
        return self


class Coupon(BaseModel):
    code: str
    subtotal: int
    discount: int
    payable: int
