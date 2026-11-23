"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class AgeRange(BaseModel):
    min_age: int = Field(ge=0, le=120)
    max_age: int = Field(ge=0, le=120)
    # a non-blank title: at most 60 characters, with at least one character that is not space, tab, CR or LF
    title: str = Field(max_length=60, pattern=r"[^ \t\r\n]")

    @model_validator(mode="after")
    def ordered(self) -> Self:
        # a rule over two fields: the schema cannot state it, so it is kept by hand here and in the frontend
        if self.min_age > self.max_age:
            raise ValueError("min_age must be at most max_age")
        return self
