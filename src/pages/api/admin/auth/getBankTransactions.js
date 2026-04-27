import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../config/dbConnect';
import BankTransaction from '../../../../models/bankTransaction';
import User from '../../../../models/user';
import BankAccount from '../../../../models/bankAccount';
import mongoose from 'mongoose';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
  await dbConnect();

  const { page = 1, limit = 10, bankId, username, status, type, maxAmount, sortByDate } = req.body;
  
  const { token } = cookie.parse(req.headers.cookie || '');
 
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if token is missing or invalid
  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload.userId || !payload.role || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    // Construct filters based on query parameters
    const filters = {};

    if (bankId) {
      if (!mongoose.Types.ObjectId.isValid(bankId)) {
        return res.status(400).json({ message: 'Invalid bankId format' });
      }
      filters.bankId = bankId;
    }

    if (username) {
      filters['userId.username'] = { $regex: username, $options: 'i' }; // Case-insensitive search for username
    }

    if (status) {
      filters.status = status;
    }

    if (type) {
      filters.type = type;
    }

    if (maxAmount) {
      filters.amount = { $lte: maxAmount }; // Filter by maximum amount
    }

    // Sorting by date
    let sortOptions = {};
    if (sortByDate === 'desc') {
      sortOptions = { createdOn: -1 }; // Sort by createdOn descending
    } else {
      sortOptions = { createdOn: 1 }; // Default sort by ascending order
    }

    const totalCounts = await BankTransaction.countDocuments(filters);
    const totalPages = Math.ceil(totalCounts / pageLimit);

    // Fetch transactions with pagination and populate referenced fields
    const transactions = await BankTransaction.find(filters)
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .sort(sortOptions)
      .populate({ path: 'userId', model: User, select: 'username mobileNumber' })
      .populate({ path: 'bankId', model: BankAccount, select: 'accountNumber bankName' })
      .lean();

      return res.status(200).json({
        transactions,
        totalCounts,
        totalPages,
        currentPage: pageNumber,
      });
  } catch (error) {
    console.error('Error fetching transactions:', error.message || error);
    return res.status(500).json({ message: `Failed to fetch transactions: ${error.message || 'Unknown error'}` });
  }
};
