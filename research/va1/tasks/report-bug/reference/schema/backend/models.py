"""The request and response models. Constraints belong here: Field(min_length=..., ge=..., pattern=...), Literal[...].

They are enforced by the server and exported in the OpenAPI schema, from which the frontend's validators are generated.
"""

from pydantic import BaseModel, Field


class BugReport(BaseModel):
    title: str = Field(min_length=5, max_length=100)
    severity: int = Field(ge=1, le=4)
    steps: list[str] = Field(max_length=10)
