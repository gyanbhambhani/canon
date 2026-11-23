"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Self

from pydantic import BaseModel, Field, model_validator


class TransferRequest(BaseModel):
    from_account: str = Field(min_length=1, max_length=20)
    to_account: str = Field(min_length=1, max_length=20)
    amount: int = Field(ge=1)
    balance: int = Field(ge=0)

    @model_validator(mode="after")
    def check_accounts_and_funds(self) -> Self:
        # the schema cannot state rules over two fields: kept by hand, here and in the frontend feature
        if self.from_account == self.to_account:
            raise ValueError("from_account and to_account must differ")
        if self.amount > self.balance:
            raise ValueError("amount must be at most balance")
        return self


class Transfer(BaseModel):
    from_account: str
    to_account: str
    amount: int
    balance: int
    remaining: int
