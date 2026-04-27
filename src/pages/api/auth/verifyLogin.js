import dbConnect from '@/config/dbConnect';
import Otp from '@/models/otp';
import User from '@/models/user';  // Updated User model import
import { signToken } from '@/utils/jwt';
import { generateGamerName } from '@/utils/helpers'; // Helper for generating usernames

// Handler for login with OTP
export default async function handler(req, res) {
  await dbConnect();

  const { mobileNumber, otp, latitude, longitude, deviceType } = req.body;

  // Validate request parameters
  if (!mobileNumber || !otp) {
    return res.status(400).json({ message: 'Mobile number and OTP are required' });
  }

  // Find OTP record
  const otpRecord = await Otp.findOne({ mobileNumber });
  if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  // Find user by mobile number
  let user = await User.findOne({ mobileNumber });

  // If user does not exist, create a new user
  if (!user) {
    const username = generateGamerName();

    // Create a new user with a default wallet and an initial transaction
    const initialTransaction = {
      createdOn: new Date(),
      completedOn: null,
      status: 'completed',
      amount: {
        cashAmount: 0,
        instantBonus: 10,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: 10
      },
      type: 'bonus',
      remark: 'game join bonus',
      DeskId: null,
      BankTransactionId: null,
    };

    user = new User({
      mobileNumber,
      username,
      wallet: {
        balance: 0,
        instantBonus: 10,
        lockedBonus: 0,
        transactions: [initialTransaction],
      },
      deviceInfo: req.headers['user-agent'] || 'Unknown device',
      ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'Unknown IP',
      deviceType: deviceType || 'android',
      latitude: latitude || null,
      longitude: longitude || null,
    });

    // Save new user
    await user.save();
  } else {
    // Check if user status is active
    if (user.status !== 'active') {
      return res.status(403).json({ message: `Your account is ${user.status}. Please contact support.` });
    }

    // Update last login with request information
    await user.updateLastLogin(req);
  }

  // Sign token for authentication
  const token = signToken({ userId: user._id });

  // Delete OTP after successful verification
  await Otp.deleteOne({ mobileNumber });

  // Respond with success message and user details
  return res.status(200).json({ 
    message: 'Login successful', 
    token, 
    userName: user.username, 
    userId: user._id, 
    wallet: {
      balance : user.wallet.balance,
      instantBonus: user.wallet.instantBonus,
      lockedBonus: user.wallet.lockedBonus,
    }
  });
}
