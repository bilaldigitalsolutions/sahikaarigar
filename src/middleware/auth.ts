import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/services/auth.service';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    uid: string;
    phone: string;
    userId: string;
    role: string;
  };
}

interface UserRow {
  id: string;
  role: string;
  phone: string;
  name: string;
  is_active: boolean;
}

async function findUserRow(firebaseUid: string): Promise<UserRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, role, phone, name, is_active')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/** Read the Firebase ID token from the cookie or the Authorization header. */
export function getTokenFromRequest(request: NextRequest): string | null {
  return (
    request.cookies.get('firebaseToken')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '') ||
    null
  );
}

/**
 * Authentication middleware. Returns a `NextResponse` when the request should
 * be short-circuited, or `null` when it may continue.
 */
export async function authMiddleware(
  request: AuthenticatedRequest
): Promise<NextResponse | null> {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } },
        { status: 401 }
      );
    }

    const firebaseUser = await verifyFirebaseToken(token);
    const user = await findUserRow(firebaseUser.uid);

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Account is deactivated' } },
        { status: 403 }
      );
    }

    request.user = {
      uid: firebaseUser.uid,
      phone: user.phone,
      userId: user.id,
      role: user.role,
    };

    return null; // Continue to the next middleware/route
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
      { status: 401 }
    );
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]) {
  return async (request: AuthenticatedRequest): Promise<NextResponse | null> => {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    if (!request.user || !roles.includes(request.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Helper to get the authenticated user from a request (or null).
 */
export async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  try {
    const firebaseUser = await verifyFirebaseToken(token);
    const user = await findUserRow(firebaseUser.uid);
    if (!user) return null;

    return {
      uid: firebaseUser.uid,
      userId: user.id,
      role: user.role,
      phone: user.phone,
      name: user.name,
    };
  } catch {
    return null;
  }
}
