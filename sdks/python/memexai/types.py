from datetime import datetime
from typing import List, Optional, Union, Any
from pydantic import BaseModel, Field

class MemoryContext(BaseModel):
    user_id: str = Field(alias="userId")
    actor: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }

class RequestContext(MemoryContext):
    tool_call_id: Optional[str] = Field(default=None, alias="toolCallId")

class MemoryFile(BaseModel):
    path: str
    size: int
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {
        "populate_by_name": True
    }

class ListFilesInput(BaseModel):
    prefix: Optional[str] = None

class ReadFileInput(BaseModel):
    path: str

class ReadFileResult(BaseModel):
    path: str
    content: str
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {
        "populate_by_name": True
    }

class WriteFileInput(BaseModel):
    path: str
    content: str
    reason: Optional[str] = None
    tool_call_id: Optional[str] = Field(default=None, alias="toolCallId")

    model_config = {
        "populate_by_name": True
    }

class WriteFileResult(BaseModel):
    path: str
    created: bool
    updated: bool

class PatchFileInput(BaseModel):
    path: str
    operation: str  # "append_lines" or "replace_lines"
    after_heading: Optional[str] = Field(default=None, alias="after_heading")
    lines: Optional[List[str]] = None
    match: Optional[str] = None
    replacement: Optional[Union[str, List[str]]] = None
    reason: Optional[str] = None
    tool_call_id: Optional[str] = Field(default=None, alias="toolCallId")

    model_config = {
        "populate_by_name": True
    }

class PatchFileResult(BaseModel):
    path: str
    operation: str
    changed: bool
    no_op: bool = Field(alias="noOp")

    model_config = {
        "populate_by_name": True
    }

class SearchResultItem(BaseModel):
    path: str
    snippet: str
    rank: float
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {
        "populate_by_name": True
    }

class SearchMemoryInput(BaseModel):
    query: str
    max_chars: Optional[int] = Field(default=None, alias="maxChars")
    limit: Optional[int] = None
    max_reads: Optional[int] = Field(default=None, alias="maxReads")
    prefix: Optional[str] = None
    tool_call_id: Optional[str] = Field(default=None, alias="toolCallId")

    model_config = {
        "populate_by_name": True
    }

class SearchMemoryResult(BaseModel):
    query: str
    answer: Optional[str] = None
    sources: Optional[List[str]] = None
    results: List[SearchResultItem]
    truncated: bool

class MemorizeInput(BaseModel):
    text: str
    max_writes: Optional[int] = Field(default=None, alias="maxWrites")
    dry_run: Optional[bool] = Field(default=None, alias="dryRun")
    tool_call_id: Optional[str] = Field(default=None, alias="toolCallId")

    model_config = {
        "populate_by_name": True
    }

class PlannedWrite(BaseModel):
    tool: str
    path: str
    reason: Optional[str] = None
    args: Any
    result: Optional[Any] = None

class MemorizeResult(BaseModel):
    text: str
    dry_run: bool = Field(alias="dryRun")
    writes: List[PlannedWrite]

    model_config = {
        "populate_by_name": True
    }
