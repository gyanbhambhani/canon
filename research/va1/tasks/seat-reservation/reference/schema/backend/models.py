"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class SeatBlock(BaseModel):
    seats: int = Field(ge=1, le=10)
    row: int = Field(ge=1, le=30)
    first_seat: int = Field(ge=1, le=20)

    @model_validator(mode="after")
    def block_fits_row(self) -> Self:
        # a rule over two fields: the schema cannot state it, so it is kept by hand, here and in the frontend feature
        if self.first_seat + self.seats - 1 > 20:
            raise ValueError("the seats must fit in the row")
        return self

