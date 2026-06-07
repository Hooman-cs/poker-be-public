import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import GatewayTransaction from '@/models/gatewayTransaction';
import type { IGatewayTransaction } from '@/models/gatewayTransaction';

type LeanGatewayTx = Omit<IGatewayTransaction, 'gatewaySignature'> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

const VALID_STATUSES = new Set(['created', 'pending', 'completed', 'failed']);
const VALID_GATEWAYS = new Set(['razorpay', 'stripe']);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const statusParam = searchParams.get('status') ?? '';
    const gatewayParam = searchParams.get('gateway') ?? '';
    const userIdParam = searchParams.get('userId') ?? '';

    const filter: Record<string, unknown> = {};

    if (statusParam && VALID_STATUSES.has(statusParam)) {
      filter.status = statusParam;
    }

    if (gatewayParam && VALID_GATEWAYS.has(gatewayParam)) {
      filter.gateway = gatewayParam;
    }

    if (userIdParam && mongoose.Types.ObjectId.isValid(userIdParam)) {
      filter.userId = new mongoose.Types.ObjectId(userIdParam);
    }

    await dbConnect();

    const [total, txs] = await Promise.all([
      GatewayTransaction.countDocuments(filter),
      GatewayTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-gatewaySignature')
        .lean<LeanGatewayTx[]>(),
    ]);

    const transactions = txs.map((tx) => ({
      id: tx._id.toString(),
      userId: tx.userId.toString(),
      gateway: tx.gateway,
      amount: serializeMoney(tx.amount, tx.currency),
      currency: tx.currency,
      status: tx.status,
      gatewayOrderId: tx.gatewayOrderId ?? null,
      gatewayPaymentId: tx.gatewayPaymentId ?? null,
      createdAt: tx.createdAt,
    }));

    return successResponse({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
