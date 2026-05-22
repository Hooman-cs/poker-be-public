/**
 * @fileoverview OTP Request API
 * Generates OTP for user mobile authentication with rate limiting.
 * Rate limit: 3 requests per 10 minutes, then blocked for 10 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Otp from '@/models/otp';
import { generateOtp } from '@/utils/helpers';

const MAX_REQUESTS = 3;
const WINDOW_MS = 10 * 60 * 1000;    // 10 minutes
const BLOCK_MS = 10 * 60 * 1000;     // 10 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MOBILE_REGEX = /^[0-9]{10}$/;

const SMS_API_KEY = process.env.TWO_FACTOR_API_KEY;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { mobileNumber } = body;

    if (!mobileNumber || !MOBILE_REGEX.test(mobileNumber)) {
      return NextResponse.json(
        { message: 'Valid 10-digit mobile number is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);

    const existingRecord = await Otp.findOne({
      mobileNumber,
      createdAt: { $gte: windowStart },
    });

    if (existingRecord) {
      // User is currently blocked
      if (existingRecord.blockedUntil && now < existingRecord.blockedUntil) {
        const unblockTime = existingRecord.blockedUntil.toLocaleTimeString();
        return NextResponse.json(
          { message: `Too many attempts. Try again after ${unblockTime}` },
          { status: 429 }
        );
      }

      // User has hit the request limit, block them
      if (existingRecord.requestCount >= MAX_REQUESTS) {
        existingRecord.blockedUntil = new Date(now.getTime() + BLOCK_MS);
        existingRecord.requestCount = 0;
        await existingRecord.save();
        return NextResponse.json(
          { message: 'Too many attempts. You are blocked for 10 minutes.' },
          { status: 429 }
        );
      }

      // Update existing record with new OTP
      existingRecord.otp = generateOtp();
      existingRecord.expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
      existingRecord.requestCount += 1;
      existingRecord.blockedUntil = null;
      await existingRecord.save();

      await sendOtp(mobileNumber, existingRecord.otp);
      return NextResponse.json(
        { message: 'OTP sent successfully' },
        { status: 200 }
      );
    }

    // No existing record, create a new one
    const newOtp = generateOtp();
    await Otp.create({
      mobileNumber,
      otp: newOtp,
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
      requestCount: 1,
      blockedUntil: null,
    });

    await sendOtp(mobileNumber, newOtp);
    return NextResponse.json(
      { message: 'OTP sent successfully' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[OTP Request Error]:', error.message);
    return NextResponse.json(
      { message: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function sendOtp(mobileNumber: string, otp: string): Promise<void> {
  if (!SMS_API_KEY) {
    // Dev mode — log OTP to console instead of sending SMS
    console.log(`[DEV] OTP for ${mobileNumber}: ${otp}`);
    return;
  }

  const formattedNumber = `91${mobileNumber}`;
  const params = new URLSearchParams({
    From: 'EFLATB',
    To: formattedNumber,
    TemplateName: 'ContentEFBOTP',
    VAR1: otp,
  });

  const response = await fetch(
    `http://2factor.in/API/V1/${SMS_API_KEY}/ADDON_SERVICES/SEND/TSMS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    }
  );

  const result = await response.json();
  if (result.Status !== 'Success') {
    throw new Error(`SMS failed: ${result.Details || 'Unknown error'}`);
  }
}
// /**
//  * @fileoverview Auth - Request OTP API (App Router)
//  * Generates an OTP, handles rate-limiting, and triggers the SMS gateway.
//  * Path: POST /api/auth/otp/request
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import Otp from '@/models/otp';
// import { generateOtp } from '@/utils/helpers';

// const MAX_OTP_REQUESTS = 3;
// const TIME_FRAME_MS = 10 * 60 * 1000; // 10 minutes
// const BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// // Ensure you add this to your .env.local file:
// // TWO_FACTOR_API_KEY=51a830db-c684-11e6-afa5-00163ef91450
// const SMS_API_KEY = process.env.TWO_FACTOR_API_KEY;

// // Strict 10-digit mobile number validation
// const mobileRegex = /^[0-9]{10}$/;

// export async function POST(request: NextRequest) {
//   try {
//     await dbConnect();

//     // 1. Extract & Validate Body
//     const body = await request.json();
//     const { mobileNumber } = body;

//     if (!mobileNumber || !mobileRegex.test(mobileNumber)) {
//       return NextResponse.json({ message: 'Valid 10-digit mobile number is required' }, { status: 400 });
//     }

//     const now = new Date();
//     const tenMinutesAgo = new Date(now.getTime() - TIME_FRAME_MS);

//     // 2. Fetch recent OTP record for rate limiting
//     let otpRecord = await Otp.findOne({
//       mobileNumber,
//       createdAt: { $gte: tenMinutesAgo },
//     });

//     if (otpRecord) {
//       // 3a. Handle Blocked Users
//       if (otpRecord.blockedUntil && now < otpRecord.blockedUntil) {
//         return NextResponse.json({ message: `Requests blocked. Try again later.` }, { status: 429 });
//       }

//       // 3b. Handle Request Limits
//       if (otpRecord.requestCount >= MAX_OTP_REQUESTS) {
//         otpRecord.blockedUntil = new Date(now.getTime() + BLOCK_DURATION_MS);
//         otpRecord.requestCount = 0; // Reset for after block expires
//         await otpRecord.save();
//         return NextResponse.json({ message: `Too many attempts. Blocked for 10 minutes.` }, { status: 429 });
//       }

//       // 3c. Update Existing Record
//       otpRecord.otp = generateOtp();
//       otpRecord.expiresAt = new Date(now.getTime() + TIME_FRAME_MS);
//       otpRecord.requestCount += 1;
//       otpRecord.blockedUntil = null;
//     } else {
//       // 4. Create New Record
//       otpRecord = new Otp({
//         mobileNumber,
//         otp: generateOtp(),
//         expiresAt: new Date(now.getTime() + TIME_FRAME_MS),
//         requestCount: 1,
//       });
//     }

//     await otpRecord.save();

//     // 5. Trigger SMS Gateway (Native Fetch)
//     await sendOtpToMobile(mobileNumber, otpRecord.otp);

//     return NextResponse.json({ message: 'OTP sent successfully' }, { status: 200 });

//   } catch (error: any) {
//     console.error('[OTP Request Error]:', error.message);
//     return NextResponse.json({ message: 'Failed to process request' }, { status: 500 });
//   }
// }

// /**
//  * Helper to dispatch SMS via 2factor API
//  */
// async function sendOtpToMobile(mobileNumber: string, otp: string) {
//   if (!SMS_API_KEY) {
//     console.warn('⚠️ TWO_FACTOR_API_KEY is not set in environment variables. Simulating SMS for dev.');
//     console.log(`[DEV MODE] OTP for ${mobileNumber} is ${otp}`);
//     return;
//   }

//   const formattedMobileNum = `91${mobileNumber}`; // Expecting clean 10 digit input
//   const url = `http://2factor.in/API/V1/${SMS_API_KEY}/ADDON_SERVICES/SEND/TSMS`;

//   const params = new URLSearchParams({
//     From: 'EFLATB',
//     To: formattedMobileNum,
//     TemplateName: 'ContentEFBOTP',
//     VAR1: otp,
//   });

//   const response = await fetch(url, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: params,
//   });

//   const result = await response.json();
//   if (result.Status !== 'Success') {
//     throw new Error(`SMS Gateway failed: ${result.Details || 'Unknown error'}`);
//   }
// }