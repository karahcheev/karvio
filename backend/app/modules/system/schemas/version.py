from pydantic import BaseModel


class VersionRead(BaseModel):
    version: str
