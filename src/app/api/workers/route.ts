import { NextRequest } from 'next/server';
import { searchWorkers, getTopRatedWorkers } from '@/services/worker.service';
import { rateLimitByIp } from '@/lib/rate-limit';
import { successResponse, errorResponse, rateLimitResponse } from '@/lib/api-response';

// Always render on demand: the handler reads request headers for rate limiting.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitByIp(request, 30, 60);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult.reset);
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const skills = searchParams.get('skills')?.split(',').filter(Boolean);
    const area = searchParams.get('area') || undefined;
    const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined;
    const maxRate = searchParams.get('maxRate') ? Number(searchParams.get('maxRate')) : undefined;
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined;
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : undefined;
    const maxDistance = searchParams.get('maxDistance') ? Number(searchParams.get('maxDistance')) : undefined;
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;

    // Search workers
    const result = await searchWorkers({
      skills: skills as any[],
      area,
      minRating,
      maxRate,
      lat,
      lng,
      maxDistance,
      page,
      limit,
    });

    return successResponse(result.workers, undefined, 200);
  } catch (error: any) {
    console.error('Search workers error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      error.message || 'Failed to search workers',
      500
    );
  }
}