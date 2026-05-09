export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    }
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected error",
      },
    },
  }
}
