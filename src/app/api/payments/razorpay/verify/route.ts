/**
 * @fileoverview Razorpay Payment Verification API
 * Validates Razorpay signature, credits user wallet, records transaction.
 * Migrated from: /api/auth/payment/verifyPayment
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import GatewayTransaction  from '@/models/gatewayTransaction';
import Wallet from '@/models/wallet';
import Transaction from '@/models/walletTransaction';
import { verifyToken } from '@/utils/jwt';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const GST_MULTIPLIER = 1.28;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { message: 'Authorization token is required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        { message: 'Missing required payment fields' },
        { status: 400 }
      );
    }

    const paymentTransaction = await GatewayTransaction.findOne({
      gatewayOrderId: razorpay_order_id,
      userId: payload.userId,
    });

    if (!paymentTransaction) {
      return NextResponse.json(
        { message: 'Payment transaction not found' },
        { status: 404 }
      );
    }

    if (paymentTransaction.status === 'successful') {
      return NextResponse.json(
        { message: 'Payment already verified' },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      paymentTransaction.status = 'failed';
      await paymentTransaction.save();
      return NextResponse.json(
        { message: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    const mainAmount = paymentTransaction.amount;
    const cashAmount = Math.round((mainAmount / GST_MULTIPLIER) * 100) / 100;
    const gstAmount = Math.round((mainAmount - cashAmount) * 100) / 100;
    const instantBonus = gstAmount;

    const wallet = await Wallet.findOne({ userId: payload.userId });
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }

    wallet.balance += cashAmount;
    wallet.instantBonus += instantBonus;
    await wallet.save();

    await Transaction.create({
      walletId: wallet._id,
      type: 'pgDeposit',
      status: 'completed',
      amount: {
        cashAmount,
        instantBonus,
        lockedBonus: 0,
        gst: gstAmount,
        tds: 0,
        otherDeductions: 0,
        total: mainAmount,
      },
      remark: 'Razorpay deposit successful',
      paymentId: paymentTransaction._id,
      createdOn: new Date(),
      completedOn: new Date(),
    });

    paymentTransaction.status = 'successful';
    paymentTransaction.gatewayPaymentId = razorpay_payment_id;    // was razPayId
    paymentTransaction.gatewaySignature = razorpay_signature;
    await paymentTransaction.save();

    return NextResponse.json(
      { message: 'Payment verified successfully' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Razorpay Verify Error]:', error.message);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
// /**
//  * @fileoverview Razorpay Payment Verification API (App Router)
//  * Validates signatures, calculates GST/Bonus, and credits user wallet.
//  * Path: POST /api/payments/razorpay/verify
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import PMGTransaction from '@/models/pmgtTransaction';
// import User from '@/models/user';
// import { verifyToken } from '@/utils/jwt';
// import crypto from 'crypto';

// const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// export async function POST(request: NextRequest) {
//   try {
//     await dbConnect();

//     // 1. Auth Check
//     const authHeader = request.headers.get('authorization');
//     const token = authHeader?.split(' ')[1];
//     if (!token) return NextResponse.json({ message: 'Token required' }, { status: 401 });

//     const decoded = (await verifyToken(token)) as { userId: string };
//     if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

//     // 2. Validate Razorpay Payload
//     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await request.json();
//     if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
//       return NextResponse.json({ message: 'Missing payment fields' }, { status: 400 });
//     }

//     // 3. Verify Signature
//     const generatedSignature = crypto
//       .createHmac('sha256', RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest('hex');

//     const transaction = await PMGTransaction.findOne({ orderId: razorpay_order_id, userId: decoded.userId });
//     if (!transaction) return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });

//     if (generatedSignature !== razorpay_signature) {
//       transaction.status = 'failed';
//       await transaction.save();
//       return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
//     }

//     // 4. Financial Logic: 28% GST Breakdown
//     const mainAmount = transaction.amount;
//     const cashAmount = Math.round((mainAmount / 1.28) * 100) / 100;
//     const gstAmount = Math.round((mainAmount - cashAmount) * 100) / 100;
//     const instantBonus = gstAmount; // Bonus matches GST per business logic[cite: 20]

//     // 5. Update User Wallet
//     const user = await User.findById(decoded.userId);
//     if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

//     user.wallet.balance += cashAmount;
//     user.wallet.instantBonus += instantBonus;
    
//     user.wallet.transactions.push({
//       amount: {
//         cashAmount,
//         instantBonus,
//         lockedBonus: 0,
//         gst: gstAmount,
//         tds: 0,
//         otherDeductions: 0,
//         total: mainAmount,
//       },
//       status: 'completed',
//       pmgtId: transaction._id,
//       type: 'pgDeposit', // <-- Using our new type
//       remark: 'Razorpay deposit successful',
//       createdOn: new Date()
//     });

//     // 6. Finalize Transaction Record
//     transaction.status = 'successful';
//     transaction.razPayId = razorpay_payment_id; 
//     transaction.razSignature = razorpay_signature;

//     await Promise.all([user.save(), transaction.save()]);

//     return NextResponse.json({ message: 'Payment verified', transaction }, { status: 200 });

//   } catch (error: any) {
//     return NextResponse.json({ message: 'Verification Error', error: error.message }, { status: 500 });
//   }
// }