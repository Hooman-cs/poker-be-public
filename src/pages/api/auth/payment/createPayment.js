import dbConnect from '@/config/dbConnect';
import PMGTransaction from '../../../../models/pmgtTransaction';
import { verifyToken } from '@/utils/jwt';
import fetch from 'node-fetch';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export default async function handler(req, res) {

    // console.log("hiii, ",req.body)
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    const decoded = verifyToken(token);
    const userId = decoded?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { amount, currency = 'INR', notes = {} } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Amount must be at least INR 1' });
    }

    const transaction = await PMGTransaction.create({
      userId,
      status: 'created',
      amount,
      currency,
      notes,
      receipt: `txn_${Date.now()}`, // Unique receipt ID for tracking
    });

    const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const body = JSON.stringify({
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: transaction._id.toString(),
      notes: notes || {}, // Ensure notes is always an object
    });

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from Razorpay API:', errorData);
      return res.status(500).json({ message: 'Failed to create order', error: errorData });
    }

    const data = await response.json();
    transaction.orderId = data.id;
    transaction.status = 'created';
    await transaction.save();

    return res.status(201).json({
      message: 'Order created successfully',
      order: data,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message);

    return res.status(500).json({
      message: 'Internal server error',
      error: error.message,
    });
  }
}
