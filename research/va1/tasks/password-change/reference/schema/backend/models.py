"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)
    confirm: str

    @model_validator(mode="after")
    def consistent(self) -> Self:
        # rules over several fields: the schema cannot state them, so they are kept by hand here and in the frontend
        if self.confirm != self.new_password:
            raise ValueError("confirm must equal new_password")
        if self.new_password == self.old_password:
            raise ValueError("new_password must differ from old_password")
        return self


class PasswordChanged(BaseModel):
    changed: bool
