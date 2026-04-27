import dbConnect from '../../../config/dbConnect';
import Otp from '../../../models/otp';
import { generateOtp } from '../../../utils/helpers';
import fetch from 'node-fetch'; // Ensure this is available for the third-party API call

const MAX_OTP_REQUESTS = 3;
const TIME_FRAME =  10 * 60 * 1000; // 10 minutes
const BLOCK_DURATION = 10 * 60 * 1000; // Block duration of 10 minutes

export default async function handler(req, res) {
  await dbConnect();

  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ message: 'Mobile number is required' });
  }

  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - TIME_FRAME);

  // Find the OTP document for this mobile number created within the last 10 minutes
  let otpRecord = await Otp.findOne({
    mobileNumber,
    createdAt: { $gte: tenMinutesAgo },
  });

  if (otpRecord) {
    if (otpRecord.blockedUntil && now < otpRecord.blockedUntil) {
      return res.status(429).json({ message: `OTP requests are blocked until ${otpRecord.blockedUntil}. Please try again later.` });
    }

    if (otpRecord.requestCount >= MAX_OTP_REQUESTS) {
      // Block the user and reset the request count
      otpRecord.blockedUntil = new Date(now.getTime() + BLOCK_DURATION);
      otpRecord.requestCount = 0;
      await otpRecord.save();

      return res.status(429).json({ message: `Too many OTP requests. You are blocked until ${otpRecord.blockedUntil}.` });
    }

    // Update the existing OTP record
    otpRecord.otp = generateOtp(); // Generate a new OTP
    otpRecord.expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // Extend the expiration time
    otpRecord.requestCount += 1; // Increment the request count
    otpRecord.blockedUntil = null; // Unblock if previously blocked
    await otpRecord.save();

    // Send OTP via third-party API
    try {
      await sendOtpToMobile(mobileNumber, otpRecord.otp); // Implement the third-party API call
      return res.status(200).json({ message: 'OTP sent successfully'});
    } catch (error) {
      console.error('Error sending OTP:', error);
      return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }
  } else {
    // Create a new OTP record if no record exists within the time frame
    const otp = generateOtp();

    otpRecord = await Otp.create({
      mobileNumber,
      otp,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // OTP expires in 10 minutes
    });

    // Send OTP via third-party API
    try {
      await sendOtpToMobile(mobileNumber, otpRecord.otp); // Implement the third-party API call
      return res.status(200).json({ message: 'OTP sent successfully'});
    } catch (error) {
      console.error('Error sending OTP:', error);
      return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }
  }
}

// Function to send OTP to the user's mobile number via the third-party API
async function sendOtpToMobile(mobileNumber, otp) {
  const formattedMobileNum = `91${mobileNumber.padStart(12, '0')}`; // Ensure 12 digits with '91' prepended
  const post = {
    From: 'EFLATB',
    To: formattedMobileNum,
    TemplateName: 'ContentEFBOTP',
    VAR1: otp,
  };

  const url = 'http://2factor.in/API/V1/51a830db-c684-11e6-afa5-00163ef91450/ADDON_SERVICES/SEND/TSMS';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(post),
  });

  const result = await response.json();
  console.log("Result for the",result)
  if (result.Status !== 'Success') {
    throw new Error('Failed to send OTP');
  }
}
