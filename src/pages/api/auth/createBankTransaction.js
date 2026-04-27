import dbConnect from '@/config/dbConnect';
import BankTransaction from '@/models/bankTransaction';
import BankAccount from '@/models/bankAccount';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';

export default async function handler(req, res) {
  // Connect to the database
  await dbConnect();

  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required.' });
  }

  try {
    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid or expired token. Please login again!' });
    }

    const userId = decoded.userId;

    // Extract parameters from request body
    const { bankId, amount, type, remark, imageUrl } = req.body;
  
    let imageUrl2 = imageUrl;

    // Validate required fields
    if (!bankId || !amount || !type || !imageUrl) {
      return res.status(400).json({
        message: 'Bank ID, amount, type, and image URL are required.',
      });
    }

    if ( type == "deposit" &&  !imageUrl) {
      return res.status(400).json({
        message: 'Bank ID, amount, type, and image URL are required.',
      });
    } 
     if( type == "withdraw" &&  !imageUrl) {
        imageUrl2 = "dfsghfdghjgfdsfgh";
     }

    // Check if the user exists and is active
    const user = await User.findById(userId).select('_id status');
    if (!user || user.status !== 'active') {
      return res.status(404).json({
        message: 'User not found or the user account is suspended.',
      });
    }

    // Validate the bank account
    const bankAccount = await BankAccount.findOne({ _id: bankId, userId });
    if (!bankAccount) {
      return res.status(400).json({
        message: 'Invalid bank account ID. Please use a linked bank account.',
      });
    }

    // Validate transaction type
    const validTypes = ['deposit', 'withdraw'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid transaction type. Allowed values: ${validTypes.join(', ')}.`,
      });
    }

    // Create a new bank transaction
    const transaction = new BankTransaction({
      userId,
      bankId,
      amount,
      type,
      remark,
      imageUrl : imageUrl2,
      createdOn: new Date(),
      status: 'pending', // Default status
    });

    // Save the transaction to the database
    await transaction.save();

    // Respond with success
    return res.status(201).json({
      message: 'Bank transaction created successfully.',
      transaction,
    });
  } catch (error) {
    console.error('Error creating bank transaction:', error.stack);
    return res.status(500).json({
      message: 'Server error while creating bank transaction.',
      error: error.message,
    });
  }
}
