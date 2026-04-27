
import dbConnect from '../../../../config/dbConnect';
import PMGTransaction from '../../../../models/pmgtTransaction';
import User from '../../../../models/user';
import mongoose from 'mongoose';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
  await dbConnect();

  const { page = 1, limit = 10, username, orderId, status } = req.body;

  const { token } = cookie.parse(req.headers.cookie || '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload.userId || !payload.role || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    // Build filters for transactions
    const filters = {};

    if (orderId) {
      filters.orderId = orderId;
    }

    if (status) {
      if (!['created', 'successful', 'failed', 'pending'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      filters.status = status;
    }

    if (username) {
      // Find the user with the provided username
      const user = await User.findOne({ username }).select('_id');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      filters.userId = user._id;
    }

    // Fetch PMG transactions with pagination and populate user details
    const transactions = await PMGTransaction.find(filters)
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .populate({ path: 'userId', model: User, select: 'username' })
      .lean();

    // Count total transactions matching filters
    const totalTransactions = await PMGTransaction.countDocuments(filters);

    return res.status(200).json({
      transactions,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalTransactions / pageLimit),
      totalTransactions,
    });
  } catch (error) {
    console.error('Error fetching PMG transactions:', error.message || error);
    return res.status(500).json({ message: `Failed to fetch PMG transactions: ${error.message || 'Unknown error'}` });
  }
}
