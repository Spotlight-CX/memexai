import re
from typing import Any, Dict

# Standard PII regex patterns
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}')
SSN_REGEX = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

def redact_pii(text: str) -> str:
    if not isinstance(text, str):
        return text
    text = EMAIL_REGEX.sub("[REDACTED_EMAIL]", text)
    text = SSN_REGEX.sub("[REDACTED_SSN]", text)
    text = PHONE_REGEX.sub("[REDACTED_PHONE]", text)
    return text

async def pii_pre_hook(tool_name: str, args: Any, ctx_dict: Dict[str, Any]) -> Any:
    """Pre-hook to filter PII from arguments passed to memory tools."""
    if not isinstance(args, dict):
        return args

    # Check for memory_write
    if tool_name == "memory_write" and "content" in args:
        new_args = dict(args)
        new_args["content"] = redact_pii(args["content"])
        return new_args

    # Check for memory_patch
    if tool_name == "memory_patch":
        new_args = dict(args)
        if "lines" in args and isinstance(args["lines"], list):
            new_args["lines"] = [redact_pii(line) for line in args["lines"]]
        if "replacement" in args:
            if isinstance(args["replacement"], list):
                new_args["replacement"] = [redact_pii(item) for item in args["replacement"]]
            elif isinstance(args["replacement"], str):
                new_args["replacement"] = redact_pii(args["replacement"])
        return new_args

    # Check for memory_memorize
    if tool_name == "memory_memorize" and "text" in args:
        new_args = dict(args)
        new_args["text"] = redact_pii(args["text"])
        return new_args

    return args
