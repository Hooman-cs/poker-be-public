import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';

import User from '@/models/user';
import type { UserStatus } from '@/models/user';

type LeanUser = { _id: Types.ObjectId; username: string; email: string; status: UserStatus };

const VALID_STATUSES = new Set<string>(['active', 'inactive', 'suspended']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(req);

    const { userId } = params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AuthError('NOT_FOUND', 'User not found');
    }

    const body = await req.json().catch(() => ({}));
    const { status } = body as { status?: unknown };

    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
      throw new AuthError('INVALID_STATE', 'status must be one of: active, inactive, suspended');
    }

    await dbConnect();

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true, runValidators: true }
    ).lean<LeanUser>();

    if (!user) {
      throw new AuthError('NOT_FOUND', 'User not found');
    }

    return successResponse({
      message: 'User status updated',
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        status: user.status,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
