"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Annotated, Self

from pydantic import BaseModel, Field, model_validator

# empty, or a valid address
EMAIL_OR_EMPTY = r"^([^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+)?$"


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    email: str = Field(pattern=EMAIL_OR_EMPTY)
    # empty, or 7 to 15 characters: an anyOf in the schema
    phone: Annotated[str, Field(max_length=0)] | Annotated[str, Field(min_length=7, max_length=15)]

    @model_validator(mode="after")
    def email_or_phone(self) -> Self:
        # the schema cannot state a rule over two fields: kept by hand, here and in the frontend feature
        if not self.email and not self.phone:
            raise ValueError("give an email or a phone")
        return self
