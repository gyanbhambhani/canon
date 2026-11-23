"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class Band(BaseModel):
    low: int = Field(ge=-50, le=50)
    high: int = Field(ge=-50, le=50)
    label: str = Field(max_length=20)

    @model_validator(mode="after")
    def high_above_low(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if self.high - self.low < 2:
            raise ValueError("high must be at least 2 more than low")
        return self
