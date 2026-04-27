import dbConnect from '@/config/dbConnect';
import BankAccount from '@/models/bankAccount'; // Import the BankAccount model
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

    // Destructure page and limit from query parameters, with default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Fetch paginated bank accounts for the authenticated user
    const bankAccounts = await BankAccount.find({ userId })
      .skip(skip)
      .limit(limit)
      .exec();

    // Get total count of bank accounts for pagination info
    const totalBankAccounts = await BankAccount.countDocuments({ userId });

    return res.status(200).json({
      bankAccounts,
      totalPages: Math.ceil(totalBankAccounts / limit),
      currentPage: page,
      totalBankAccounts,
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
