/**
 * @fileoverview Razorpay Payment Verification API (App Router)
 * Validates signatures, calculates GST/Bonus, and credits user wallet.
 * Path: POST /api/payments/razorpay/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PMGTransaction from '@/models/pmgtTransaction';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Validate Razorpay Payload
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await request.json();
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ message: 'Missing payment fields' }, { status: 400 });
    }

    // 3. Verify Signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const transaction = await PMGTransaction.findOne({ orderId: razorpay_order_id, userId: decoded.userId });
    if (!transaction) return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });

    if (generatedSignature !== razorpay_signature) {
      transaction.status = 'failed';
      await transaction.save();
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    // 4. Financial Logic: 28% GST Breakdown
    const mainAmount = transaction.amount;
    const cashAmount = Math.round((mainAmount / 1.28) * 100) / 100;
    const gstAmount = Math.round((mainAmount - cashAmount) * 100) / 100;
    const instantBonus = gstAmount; // Bonus matches GST per business logic[cite: 20]

    // 5. Update User Wallet
    const user = await User.findById(decoded.userId);
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    user.wallet.balance += cashAmount;
    user.wallet.instantBonus += instantBonus;
    
    user.wallet.transactions.push({
      amount: {
        cashAmount,
        instantBonus,
        lockedBonus: 0,
        gst: gstAmount,
        tds: 0,
        otherDeductions: 0,
        total: mainAmount,
      },
      status: 'completed',
      pmgtId: transaction._id,
      type: 'pgDeposit', // <-- Using our new type
      remark: 'Razorpay deposit successful',
      createdOn: new Date()
    });

    // 6. Finalize Transaction Record
    transaction.status = 'successful';
    transaction.razPayId = razorpay_payment_id; 
    transaction.razSignature = razorpay_signature;

    await Promise.all([user.save(), transaction.save()]);

    return NextResponse.json({ message: 'Payment verified', transaction }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Verification Error', error: error.message }, { status: 500 });
  }
}