import { NextRequest } from 'next/server';
import Razorpay from 'razorpay';

import dbConnect from '@/config/dbConnect';
import { DEFAULT_CURRENCY } from '@/config/constants';
import { requireUser } from '@/lib/auth/requireUser';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { parseAmount } from '@/lib/api/money';
import { ServiceError } from '@/services/gameService';
import GatewayTransaction from '@/models/gatewayTransaction';

// Module-level instance — created once and reused across requests.
// Empty strings are safe defaults; the handler validates env vars before use.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new ServiceError('RAZORPAY_NOT_CONFIGURED', 'Payment gateway is not configured');
    }

    const body = await req.json().catch(() => ({}));
    const parsedAmount = parseAmount((body as { amount?: unknown }).amount, DEFAULT_CURRENCY);

    // receipt must be ≤ 40 chars; ObjectId (24) + '-' + timestamp (13) = 38.
    const receipt = `${userId}-${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: parsedAmount,
      currency: DEFAULT_CURRENCY,
      receipt,
    });

    await GatewayTransaction.create({
      userId,
      gateway: 'razorpay',
      amount: parsedAmount,
      currency: DEFAULT_CURRENCY,
      status: 'created',
      gatewayOrderId: order.id,
    });

    return successResponse(
      {
        orderId: order.id,
        // Raw integer intentional: frontend passes this directly to the
        // Razorpay checkout SDK, which requires the minor-unit integer.
        amount: parsedAmount,
        currency: DEFAULT_CURRENCY,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
