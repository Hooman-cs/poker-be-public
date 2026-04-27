import dbConnect from '@/config/dbConnect';
import PMGTransaction from '../../../../models/pmgtTransaction';
import User from '../../../../models/user';
import { verifyToken } from '@/utils/jwt';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export default async function handler(req, res) {
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

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const orderId = razorpay_order_id;
    // Fetch the transaction from the database
    const transaction = await PMGTransaction.findOne({orderId, userId });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'successful') {
      return res.status(400).json({ message: 'Transaction already verified' });
    }

    // Generate the HMAC signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Verify the signatures
    if (generatedSignature !== razorpay_signature) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ message: 'Invalid signature. Payment verification failed' });
    }

    // Fetch the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate wallet breakdown
    const mainAmount = transaction.amount;
    const cashAmount = Math.round((mainAmount / 1.28) * 100) / 100;
    const gstAmount = Math.round((mainAmount - cashAmount) * 100) / 100;
    const instantBonus = gstAmount;

    // Update the wallet
    user.wallet.balance += cashAmount;
    user.wallet.instantBonus += instantBonus;

    // Add a wallet transaction
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
      pmgtId : transaction._id,
      type: 'pgDeposit',
      remark: 'Payment verified from payment gateway and wallet credited',
    });

    await user.save();

    // Update the transaction status to successful
    transaction.status = 'successful';
    transaction.razPayId = razorpay_payment_id; 
    transaction.razSignature = razorpay_signature;
    await transaction.save();

    return res.status(200).json({ message: 'Payment verified successfully', transaction });
  } catch (error) {
    console.error('Error verifying payment:', error.message);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
