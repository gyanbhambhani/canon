"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class Allocation(BaseModel):
    ads: int = Field(ge=0, le=100)
    dev: int = Field(ge=0, le=100)
    ops: int = Field(ge=0, le=100)
    project: str = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def shares_total_100(self) -> Self:
        # the schema cannot state a rule over three fields: kept by hand, here and in the frontend feature
        if self.ads + self.dev + self.ops != 100:
            raise ValueError("ads + dev + ops must be 100")
        return self
