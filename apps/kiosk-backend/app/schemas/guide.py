from pydantic import BaseModel
from typing import List

class GuideRequest(BaseModel):
  lang: str
  wizard: List[str]

class ChecklistSection(BaseModel):
  title: str
  items: List[str]

class GuideResponse(BaseModel):
  checklist_sections: List[ChecklistSection]
  qr_url: str
