import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
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
      return res.status(401).json({ message: 'Invalid authorization token' });
    }

    // Find user by ID
    const wallet = await User.findById(userId).select({
        'wallet.balance': 1,
        'wallet.instantBonus': 1,
        'wallet.lockedBonus': 1,
      });
      
       
    
    if (!wallet || !wallet.wallet) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'wallet fetched successfully',
      wallet: wallet.wallet,
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
