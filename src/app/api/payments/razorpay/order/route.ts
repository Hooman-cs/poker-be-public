/**
 * @fileoverview Razorpay Order Creation API (App Router)
 * Creates a pending transaction in our DB and initializes a Razorpay Order.
 * Path: POST /api/payments/razorpay/order
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PMGTransaction from '@/models/pmgtTransaction';
import { verifyToken } from '@/utils/jwt';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Authorization token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Validate Input
    const { amount, currency = 'INR', notes = {} } = await request.json();
    if (!amount || amount < 1) return NextResponse.json({ message: 'Amount must be at least 1' }, { status: 400 });

    // 3. Create Internal Transaction Log
    const transaction = await PMGTransaction.create({
      userId: decoded.userId,
      status: 'created',
      amount,
      currency,
      notes,
      receipt: `txn_${Date.now()}`,
    });

    // 4. Initialize Razorpay Order via Native Fetch
    const authString = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: transaction._id.toString(),
        notes: notes || {},
      }),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json();
      return NextResponse.json({ message: 'Razorpay Order Failed', error: errorData }, { status: 500 });
    }

    const orderData = await razorpayResponse.json();

    // 5. Link Order ID to Transaction
    transaction.orderId = orderData.id;
    await transaction.save();

    return NextResponse.json({
      message: 'Order created',
      order: orderData,
      transactionId: transaction._id,
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
  }
}
