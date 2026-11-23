"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class StayRequest(BaseModel):
    # a non-blank guest: at most 40 characters, with at least one character that is not space, tab, CR or LF
    guest: str = Field(max_length=40, pattern=r"[^ \t\r\n]")
    start: int = Field(ge=0, le=365)
    end: int

    @model_validator(mode="after")
    def end_after_start(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if self.end <= self.start:
            raise ValueError("end must be after start")
        if self.end - self.start > 30:
            raise ValueError("a stay is at most 30 nights")
        return self


class Stay(BaseModel):
    guest: str
    start: int
    end: int
    nights: int
