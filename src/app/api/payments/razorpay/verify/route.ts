import { NextRequest } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { DEFAULT_CURRENCY, GST_MULTIPLIER } from '@/config/constants';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import GatewayTransaction from '@/models/gatewayTransaction';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import AppConfig from '@/models/appConfig';

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireUser(req);

    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body as {
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
    };

    if (
      typeof razorpay_order_id !== 'string' || !razorpay_order_id ||
      typeof razorpay_payment_id !== 'string' || !razorpay_payment_id ||
      typeof razorpay_signature !== 'string' || !razorpay_signature
    ) {
      throw new AuthError('MISSING_BANK_FIELD', 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required');
    }

    // HMAC verification — must happen before any DB read.
    const hmacBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(hmacBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const actualBuf = Buffer.from(razorpay_signature, 'hex');
    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) throw new AuthError('INVALID_PAYMENT_SIGNATURE', 'Payment signature verification failed');

    await dbConnect();

    const gtx = await GatewayTransaction.findOne({ gatewayOrderId: razorpay_order_id });
    if (!gtx) {
      throw new AuthError('NOT_FOUND', 'Gateway transaction not found');
    }

    if (!gtx.userId.equals(new mongoose.Types.ObjectId(userId))) {
      throw new AuthError('FORBIDDEN', 'Payment does not belong to this user');
    }

    if (gtx.status !== 'created') {
      throw new AuthError('PAYMENT_ALREADY_PROCESSED', 'This payment has already been processed');
    }

    const config = await AppConfig.findOne({});
    const gstMultiplier = config?.gstMultiplier ?? GST_MULTIPLIER;
    const depositBonusRate = config?.depositBonusRate ?? 1.0;

    const gross = gtx.amount;
    const cashAmount = Math.round(gross / gstMultiplier);
    const gstAmount = gross - cashAmount;
    const bonusAmount = Math.round(gstAmount * depositBonusRate);
    const currency = DEFAULT_CURRENCY;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOneAndUpdate(
          { userId },
          { $inc: { balance: cashAmount, instantBonus: bonusAmount } },
          { new: true, session }
        );
        if (!wallet) throw new AuthError('NOT_FOUND', 'Wallet not found');

        await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              type: 'deposit',
              status: 'completed',
              amount: {
                cashAmount,
                instantBonus: bonusAmount,
                gst: gstAmount,
                total: gtx.amount,
              },
              currency,
              completedAt: new Date(),
            },
          ],
          { session }
        );

        await GatewayTransaction.findByIdAndUpdate(
          gtx._id,
          {
            status: 'completed',
            gatewayPaymentId: razorpay_payment_id,
            gatewaySignature: razorpay_signature,
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return successResponse({
      message: 'Payment verified',
      credited: serializeMoney(cashAmount, currency),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
