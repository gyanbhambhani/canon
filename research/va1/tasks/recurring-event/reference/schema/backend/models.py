"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class RecurringRequest(BaseModel):
    interval_days: int = Field(ge=1, le=365)
    occurrences: int = Field(ge=1, le=52)
    # a non-blank title: at least one character that is not space, tab, CR or LF
    title: str = Field(pattern=r"[^ \t\r\n]")

    @model_validator(mode="after")
    def span_at_most_a_year(self) -> Self:
        # the schema cannot state a computed rule: kept by hand, here and in the frontend feature
        if self.interval_days * self.occurrences > 365:
            raise ValueError("the span (interval_days * occurrences) is at most 365 days")
        return self


class Recurring(BaseModel):
    interval_days: int
    occurrences: int
    title: str
    span_days: int
