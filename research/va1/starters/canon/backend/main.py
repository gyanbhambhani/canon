"""The FastAPI app. canon build writes this file once and never changes it again: it is yours."""

from fastapi import FastAPI

from canon_generated.api import router
from canon_generated.runtime import install

app = FastAPI()
install(app)
app.include_router(router)
