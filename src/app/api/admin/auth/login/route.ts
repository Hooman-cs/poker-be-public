import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import Admin from '@/models/admin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { signToken } from '@/utils/jwt';
import { ADMIN_TOKEN_TTL, ADMIN_COOKIE_MAX_AGE_S } from '@/config/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body as { email?: unknown; password?: unknown };

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    await dbConnect();

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    const match = await admin.comparePassword(password);
    if (!match) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    if (admin.status !== 'active') {
      throw new AuthError('ADMIN_NOT_ACTIVE', 'Admin account is not active');
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = signToken(
      { userId: admin._id.toString(), role: 'admin' },
      { expiresIn: ADMIN_TOKEN_TTL }
    );

    const res = successResponse({
      message: 'Login successful',
      adminId: admin._id.toString(),
      name: admin.name,
      email: admin.email,
    });

    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE_S,
      path: '/',
    });

    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
