"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Terms(BaseModel):
    email: str = Field(pattern=r"^[^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+$")
    accepted: Literal[True]
