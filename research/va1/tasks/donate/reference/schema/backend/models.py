"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Donation(BaseModel):
    amount: float = Field(ge=1.0, le=5000.0)
    currency: Literal["USD", "EUR"]
    anonymous: bool
