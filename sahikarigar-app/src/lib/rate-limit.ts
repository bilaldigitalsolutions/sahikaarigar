import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let redisUnavailable = false;

/**
 * Lazily create the Upstash Redis client.
 *
 * Rate limiting is optional: when the credentials are missing (e.g. local
 * development) requests are allowed through instead of throwing at import time.
 */
function getRedis(): Redis | null {
  if (redis) return redis;
  if (redisUnavailable) return null;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    redisUnavailable = true;
    console.warn('⚠️ Upstash Redis is not configured - rate limiting is disabled');
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

const allowAll = (limit: number): RateLimitResult => ({
  success: true,
  remaining: limit,
  reset: 0,
});

export async function rateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 60
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) return allowAll(limit);

  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - window * 1000;

  try {
    // Remove old entries
    await client.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const current = await client.zcard(key);

    if (current >= limit) {
      return { success: false, remaining: 0, reset: window };
    }

    // Add new entry
    await client.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await client.expire(key, window);

    return { success: true, remaining: limit - current - 1, reset: window };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // If Redis fails, allow the request
    return allowAll(limit);
  }
}

// Helper function to get client IP
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return ip;
}

// Rate limit by IP
export async function rateLimitByIp(
  request: Request,
  limit: number = 10,
  window: number = 60
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  return rateLimit(`ip:${ip}`, limit, window);
}

// Rate limit by user ID
export async function rateLimitByUser(
  userId: string,
  limit: number = 10,
  window: number = 60
): Promise<RateLimitResult> {
  return rateLimit(`user:${userId}`, limit, window);
}

// Rate limit by phone number
export async function rateLimitByPhone(
  phone: string,
  limit: number = 3,
  window: number = 3600
): Promise<RateLimitResult> {
  return rateLimit(`phone:${phone}`, limit, window);
}
