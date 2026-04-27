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

    const {
      startDate = '1970-01-01',
      endDate = new Date().toISOString(),
      type = '',
      status = '',
      page = 1,
      limit = 10
    } = req.query;

    // Define valid enums for type and status
    const validTypes = ['deposit', 'withdraw', 'deskIn', 'deskWithdraw', 'bonus'];
    const validStatuses = ['failed', 'completed', 'successful'];

    // Validate type and status
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Valid types are: ${validTypes.join(', ')}` });
    }
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}` });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter transactions
    const transactions = user.wallet.transactions.filter(transaction => {
      const createdOn = new Date(transaction.createdOn);
      return (
        createdOn >= new Date(startDate) &&
        createdOn <= new Date(endDate) &&
        (type ? transaction.type === type : true) &&
        (status ? transaction.status === status : true)
      );
    });

    // Pagination
    const paginatedTransactions = transactions.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      message: 'Transactions fetched successfully',
      transactions: paginatedTransactions,
      page: parseInt(page),
      limit: parseInt(limit),
      totalTransactions: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
