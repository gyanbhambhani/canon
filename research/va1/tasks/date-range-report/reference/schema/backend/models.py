"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class ReportRange(BaseModel):
    from_day: int = Field(ge=1, le=31)
    to_day: int = Field(ge=1, le=31)
    granularity: Literal["day", "week"]

    @model_validator(mode="after")
    def range_rules(self) -> Self:
        # rules over several fields: the schema cannot state them, so they are kept by hand, here and in the frontend feature
        if self.to_day < self.from_day:
            raise ValueError("to_day must not be before from_day")
        if self.to_day - self.from_day > 14 and self.granularity != "week":
            raise ValueError("a range wider than 14 days must be week")
        return self

