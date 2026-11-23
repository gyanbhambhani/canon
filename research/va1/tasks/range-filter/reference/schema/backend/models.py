"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class PriceFilter(BaseModel):
    min_price: int = Field(ge=0)
    max_price: int = Field(ge=0)
    category: Literal["food", "drink", "tool"]

    @model_validator(mode="after")
    def min_not_above_max(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if self.min_price > self.max_price:
            raise ValueError("min_price must be at most max_price")
        return self
