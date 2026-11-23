"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class LoanApplication(BaseModel):
    principal: int = Field(ge=1000, le=1000000)
    months: int = Field(ge=6, le=360)
    monthly_payment: int = Field(ge=1, le=1000000)

    @model_validator(mode="after")
    def payments_cover_principal(self) -> Self:
        # a rule over three fields: the schema cannot state it, so it is kept by hand, here and in the frontend feature
        if self.monthly_payment * self.months < self.principal:
            raise ValueError("the payments must cover the principal")
        return self

