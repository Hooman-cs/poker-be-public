import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { generateGamerName } from '@/utils/helpers';
import User from '@/models/user';

export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    await dbConnect();

    const suggestions: string[] = [];
    const seen = new Set<string>();
    let attempts = 0;

    while (suggestions.length < 3 && attempts < 60) {
      attempts++;
      const candidate = generateGamerName();
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      // Case-insensitive availability check. generateGamerName produces only
      // alphanumeric characters so the regex has no injection surface.
      const taken = await User.exists({
        username: { $regex: new RegExp(`^${candidate}$`, 'i') },
      });

      if (!taken) {
        suggestions.push(candidate);
      }
    }

    return successResponse({ suggestions });
  } catch (err) {
    return errorResponse(err);
  }
}
