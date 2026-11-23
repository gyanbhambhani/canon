"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class Meeting(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    start_hour: int = Field(ge=0, le=23)
    duration_min: int = Field(ge=15, le=240, multiple_of=15)

    @model_validator(mode="after")
    def ends_by_midnight(self) -> Self:
        # a computed rule over two fields: the schema cannot state it, so it is kept by hand here and in the frontend
        if self.start_hour * 60 + self.duration_min > 1440:
            raise ValueError("the meeting must end by midnight")
        return self
