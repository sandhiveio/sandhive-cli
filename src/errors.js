export class CliError extends Error {
  constructor(code, message, { retryable = false, retryAfter = null, exitCode = 1 } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.exitCode = exitCode;
  }
}

export function errorResult(error) {
  return {
    schema_version: 1,
    status: 'error',
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error instanceof CliError ? error.message : 'An unexpected error occurred.',
      retryable: error.retryable || false,
      retry_after: error.retryAfter ?? null,
    },
  };
}
