"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class SignupRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)

    @model_validator(mode="after")
    def password_differs_from_email(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if self.password == self.email:
            raise ValueError("password must differ from the email")
        return self


class Account(BaseModel):
    email: str
