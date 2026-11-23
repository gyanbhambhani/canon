"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Reminder(BaseModel):
    minutes_before: int = Field(ge=5, le=1440)
    channel: Literal["email", "sms", "push"]
