"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class DiscountRule(BaseModel):
    percent: int = Field(ge=0, le=100)
    fixed_cents: int = Field(ge=0, le=100000)
    name: str = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def exactly_one_positive(self) -> Self:
        # a rule over two fields: the schema cannot state it, so it is kept by hand, here and in the frontend feature
        if (self.percent > 0) == (self.fixed_cents > 0):
            raise ValueError("exactly one of percent and fixed_cents must be greater than 0")
        return self

