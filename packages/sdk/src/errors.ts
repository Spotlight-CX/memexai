export type MemexAIErrorBody = {
  error?: {
    code?: string
    message?: string
    issues?: unknown
  }
}

export class MemexAIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "MemexAIError"
  }
}
