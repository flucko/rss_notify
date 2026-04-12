from pydantic import BaseModel
from typing import List

class SettingsBase(BaseModel):
    pushover_token: str
    pushover_user_key: str
    check_frequency_minutes: int = 5

class SettingsCreate(SettingsBase):
    pass

class Settings(SettingsBase):
    id: int
    class Config:
        from_attributes = True

class KeywordBase(BaseModel):
    word: str

class KeywordCreate(KeywordBase):
    pass

class Keyword(KeywordBase):
    id: int
    feed_id: int
    class Config:
        from_attributes = True

class FeedBase(BaseModel):
    name: str
    url: str
    filter_target: str = "title"

class FeedCreate(FeedBase):
    pass

class FeedUpdate(BaseModel):
    filter_target: str

class Feed(FeedBase):
    id: int
    keywords: List[Keyword] = []
    class Config:
        from_attributes = True
