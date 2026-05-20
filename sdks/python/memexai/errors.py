class MemexError(Exception):
    """Base exception for all MemexAI SDK errors, mirroring packages/core/src/errors.ts"""
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self):
        return f"{self.code}: {self.message}"
