import { NextResponse } from 'next/server';

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Error response helper
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Paginated response helper
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  },
  message?: string
) {
  return NextResponse.json({
    success: true,
    data,
    pagination,
    ...(message && { message }),
  });
}

/**
 * Not found response
 */
export function notFoundResponse(message: string = 'Resource not found') {
  return errorResponse('NOT_FOUND', message, 404);
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return errorResponse('UNAUTHORIZED', message, 401);
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return errorResponse('FORBIDDEN', message, 403);
}

/**
 * Validation error response
 */
export function validationErrorResponse(message: string, details?: unknown) {
  return errorResponse('VALIDATION_ERROR', message, 400, details);
}

/**
 * Rate limit response
 */
export function rateLimitResponse(reset: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': reset.toString(),
      },
    }
  );
}

/**
 * Internal error response
 */
export function internalErrorResponse(message: string = 'Internal server error') {
  return errorResponse('INTERNAL_ERROR', message, 500);
}