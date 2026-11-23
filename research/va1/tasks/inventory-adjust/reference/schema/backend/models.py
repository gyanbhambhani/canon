"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class StockRemoval(BaseModel):
    on_hand: int = Field(ge=0, le=100000)
    remove: int = Field(ge=1)
    reason: Literal["sold", "damaged", "lost"]

    @model_validator(mode="after")
    def remove_within_stock(self) -> Self:
        # a rule over two fields: the schema cannot state it, so it is kept by hand, here and in the frontend feature
        if self.remove > self.on_hand:
            raise ValueError("remove must not exceed on_hand")
        return self


class StockResult(BaseModel):
    on_hand: int
    remove: int
    reason: str
    left: int

