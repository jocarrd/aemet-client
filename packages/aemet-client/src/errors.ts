export interface AemetErrorContext {
  endpoint?: string;
  status?: number;
  description?: string;
  cause?: unknown;
}

export class AemetError extends Error {
  readonly endpoint?: string;
  readonly status?: number;
  readonly description?: string;

  constructor(message: string, context: AemetErrorContext = {}) {
    super(message, context.cause !== undefined ? { cause: context.cause } : undefined);
    this.name = "AemetError";
    if (context.endpoint !== undefined) this.endpoint = context.endpoint;
    if (context.status !== undefined) this.status = context.status;
    if (context.description !== undefined) this.description = context.description;
  }
}

export class AemetAuthError extends AemetError {
  constructor(context: AemetErrorContext = {}) {
    super("AEMET API rejected the request (invalid or missing API key).", context);
    this.name = "AemetAuthError";
  }
}

export class AemetNotFoundError extends AemetError {
  constructor(context: AemetErrorContext = {}) {
    super("AEMET API resource not found.", context);
    this.name = "AemetNotFoundError";
  }
}

export class AemetRateLimitError extends AemetError {
  readonly retryAfterMs?: number;

  constructor(context: AemetErrorContext & { retryAfterMs?: number } = {}) {
    super("AEMET API rate limit exceeded.", context);
    this.name = "AemetRateLimitError";
    if (context.retryAfterMs !== undefined) this.retryAfterMs = context.retryAfterMs;
  }
}

export class AemetServerError extends AemetError {
  constructor(context: AemetErrorContext = {}) {
    super("AEMET API server error.", context);
    this.name = "AemetServerError";
  }
}

export class AemetNetworkError extends AemetError {
  constructor(message: string, context: AemetErrorContext = {}) {
    super(message, context);
    this.name = "AemetNetworkError";
  }
}

export class AemetInvalidResponseError extends AemetError {
  constructor(message: string, context: AemetErrorContext = {}) {
    super(message, context);
    this.name = "AemetInvalidResponseError";
  }
}
