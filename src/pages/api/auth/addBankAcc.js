import dbConnect from '@/config/dbConnect';
import User from '@/models/user'; // Import your User model
import BankAccount from '@/models/bankAccount'; // Import the BankAccount model
import { verifyToken } from '@/utils/jwt'; // Import your JWT verification function

export default async function handler(req, res) {
  // Connect to the database
  await dbConnect();

  // Check if the request method is POST
  if (req.method !== 'POST') {
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

    // Destructure the request body
    const { accountNumber, bankName, ifscCode, accountHolderName, isDefault = false } = req.body;

    // Validate request parameters
    if (!accountNumber || !bankName || !ifscCode || !accountHolderName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user by userId
    const user = await User.findById(userId).select('_id status');

    // Check if the user exists
    if (!user._id) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user's status is active
    if (user.status !== 'active') {
      return res.status(404).json({ message: `Account is ${user.status}` });
    }

    // If isDefault is true, make all other bank accounts with isDefault true to false
    if (isDefault) {
      await BankAccount.updateMany(
        { userId: user._id, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    // Create a new bank account document with the requested fields
    const newBankAccount = new BankAccount({
      userId: user._id, // Reference to the user
      accountNumber,
      bankName,
      ifscCode,
      accountHolderName,
      isDefault, // Set isDefault based on request
    });

    // Save the new bank account to the database
    await newBankAccount.save();

    // Return success response
    return res.status(201).json({
      message: 'Bank account added successfully',
      bankAccount: newBankAccount,
    });
  } catch (error) {
    console.error('Error adding bank account:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
