import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';

import AppConfig from '@/models/appConfig';
import type { IAppConfig } from '@/models/appConfig';

type LeanConfig = IAppConfig & { _id: Types.ObjectId; updatedAt: Date };

const DEFAULT_GST_MULTIPLIER = 1.28;
const DEFAULT_DEPOSIT_BONUS_RATE = 1.0;

function serializeConfig(config: LeanConfig | null) {
  return {
    gstMultiplier: config?.gstMultiplier ?? DEFAULT_GST_MULTIPLIER,
    depositBonusRate: config?.depositBonusRate ?? DEFAULT_DEPOSIT_BONUS_RATE,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await dbConnect();

    const config = await AppConfig.findOne({}).lean<LeanConfig>();
    return successResponse(serializeConfig(config));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));

    const update: Partial<IAppConfig> = {};

    if ('gstMultiplier' in body) {
      if (typeof body.gstMultiplier !== 'number') {
        throw new AuthError('INVALID_STATE', 'gstMultiplier must be a number');
      }
      if (body.gstMultiplier < 1) {
        throw new AuthError('INVALID_STATE', 'gstMultiplier must be >= 1');
      }
      update.gstMultiplier = body.gstMultiplier;
    }

    if ('depositBonusRate' in body) {
      if (typeof body.depositBonusRate !== 'number') {
        throw new AuthError('INVALID_STATE', 'depositBonusRate must be a number');
      }
      if (body.depositBonusRate < 0 || body.depositBonusRate > 1) {
        throw new AuthError('INVALID_STATE', 'depositBonusRate must be between 0 and 1');
      }
      update.depositBonusRate = body.depositBonusRate;
    }

    await dbConnect();

    if (Object.keys(update).length === 0) {
      const config = await AppConfig.findOne({}).lean<LeanConfig>();
      return successResponse(serializeConfig(config));
    }

    const updated = await AppConfig.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    ).lean<LeanConfig>();

    return successResponse({
      message: 'Config updated',
      config: serializeConfig(updated),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
