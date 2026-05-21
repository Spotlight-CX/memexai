class MemexError(Exception):
    """Base exception for all MemexAI SDK errors, mirroring packages/core/src/errors.ts"""
    def __init__(self, code: str, message: str, status_code=None, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details

    def __str__(self):
        return f"{self.code}: {self.message}"
