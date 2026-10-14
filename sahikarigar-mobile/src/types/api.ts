// API Response Types

/** The auth-server wraps successful responses as `{ ok: true, ...data }`. */
export interface ApiEnvelope {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}
