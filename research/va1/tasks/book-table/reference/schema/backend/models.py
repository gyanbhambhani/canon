"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class TableBooking(BaseModel):
    party_size: int = Field(ge=1, le=12)
    # a non-blank name: at most 40 characters, with at least one character that is not space, tab, CR or LF
    name: str = Field(max_length=40, pattern=r"[^ \t\r\n]")
