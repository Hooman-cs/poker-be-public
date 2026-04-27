import dbConnect from '@/config/dbConnect';
import BankTransaction from '../../../models/bankTransaction';
import BankAccount from '../../../models/bankAccount';
import { verifyToken } from '@/utils/jwt'; // Import your JWT verification function

export default async function handler(req, res) {
  // Connect to the database
  await dbConnect();

  // Check if the request method is GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get the token from headers
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  // Validate token
  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    // Verify token and extract user ID
    const decoded = verifyToken(token);
    const userId = decoded?.userId; // Assuming your token includes userId
    if (!userId) {
      return res.status(401).json({ message: 'Authorization token is not valid' });
    }

    // Destructure parameters from query
    const {
      startDate = '1970-01-01', // default to the earliest date
      endDate = new Date().toISOString(), // default to the current date
      type = '', // default to all transaction types
      status = '', // default to all transaction statuses
      page = 1,
      limit = 10
    } = req.query;

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Define valid enums for type and status
    const validTypes = ['deposit', 'withdraw'];
    const validStatuses = ['failed', 'completed', 'successful', 'waiting'];

    // Validate type and status
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Valid types are: ${validTypes.join(', ')}` });
    }
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}` });
    }

    // Build the query object
    const query = {
      userId,
      createdOn: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    // Fetch paginated bank transactions for the authenticated user
    const bankTransactions = await BankTransaction.find(query)
    .populate({
      path: 'bankId', // Populating the bankId reference
      select: 'accountNumber bankName ifscCode accountHolderName', // Select only these fields
    })
    .skip(skip)
    .limit(limit)
    .exec();

    // Get the total count of bank transactions for pagination info
    const totalBankTransactions = await BankTransaction.countDocuments(query);

    const transactionsWithBankInfo = bankTransactions.map((transaction) => ({
      createdOn: transaction.createdOn,
      status: transaction.status,
      amount: transaction.amount,
      type: transaction.type,
      remark: transaction.remark,
      imageUrl: transaction.imageUrl,
      bankAccount: transaction.bankId ? {
        accountNumber: transaction.bankId.accountNumber,
        bankName: transaction.bankId.bankName,
        ifscCode: transaction.bankId.ifscCode,
        accountHolderName: transaction.bankId.accountHolderName,
      } : null, // Handle case where bankId is not populated
    }));

    return res.status(200).json({
      bankTransactions: transactionsWithBankInfo,
      totalPages: Math.ceil(totalBankTransactions / limit),
      currentPage: parseInt(page, 10),
      totalBankTransactions,
    });
    
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
