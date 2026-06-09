import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import PracticeSession from '@/models/practiceSession';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1,   parseInt(searchParams.get('page')  ?? '1',  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    await dbConnect();

    const [sessions, total] = await Promise.all([
      PracticeSession
        .find()
        .populate('userId', 'username email')
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PracticeSession.countDocuments(),
    ]);

    return successResponse({
      sessions: sessions.map((s) => {
        const populated = s.userId as unknown as { _id: { toString(): string }; username: string; email: string } | null;
        return {
          _id: (s._id as { toString(): string }).toString(),
          user: populated
            ? { id: populated._id.toString(), username: populated.username, email: populated.email }
            : null,
          deskId: s.deskId.toString(),
          startedAt: s.startedAt,
          endedAt: s.endedAt ?? null,
          finalChips: s.finalChips != null
            ? serializeMoney(s.finalChips, 'INR')
            : null,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
