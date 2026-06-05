import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import User from '@/models/user';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { username } = body as { username?: unknown };

    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new AuthError('MISSING_USERNAME', 'username is required and must be a non-empty string');
    }

    const trimmed = username.trim();

    const user = await User.findById(userId);
    if (!user) {
      throw new AuthError('NOT_FOUND', 'User not found');
    }

    if (user.usernameLocked) {
      throw new AuthError('USERNAME_LOCKED', 'Username has already been set and cannot be changed');
    }

    // Case-insensitive uniqueness check — exclude the current user so they can
    // "re-confirm" their existing generated name without being blocked by it.
    const taken = await User.exists({
      _id: { $ne: user._id },
      username: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
    });

    if (taken) {
      throw new AuthError('USERNAME_TAKEN', 'This username is already taken');
    }

    user.username = trimmed;
    user.usernameLocked = true;
    await user.save();

    return successResponse({
      message: 'Username set',
      userName: user.username,
      usernameLocked: true,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
