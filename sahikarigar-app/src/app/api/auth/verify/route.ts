import { NextRequest } from 'next/server';
import { verifyFirebaseToken, getOrCreateUser } from '@/services/auth.service';
import { rateLimitByIp } from '@/lib/rate-limit';
import { successResponse, errorResponse, rateLimitResponse } from '@/lib/api-response';

// Always render on demand: the handler reads request headers for rate limiting.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitByIp(request, 10, 60);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult.reset);
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return errorResponse('VALIDATION_ERROR', 'Token is required', 400);
    }

    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(token);

    // Get or create user
    const user = await getOrCreateUser(firebaseUser);

    return successResponse({
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        phone: user.phone,
        name: user.name,
        role: user.role,
        location: {
          area: user.locationArea,
          city: user.locationCity,
        },
      },
      token,
    }, 'Login successful');
  } catch (error: any) {
    console.error('Auth verify error:', error);
    return errorResponse(
      'UNAUTHORIZED',
      error.message || 'Invalid token',
      401
    );
  }
}