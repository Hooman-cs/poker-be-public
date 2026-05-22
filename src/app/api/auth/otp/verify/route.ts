/**
 * @fileoverview OTP Verify API
 * Validates OTP, creates user if new, creates wallet, issues JWT.
 * Migrated from: /api/auth/verifyLogin
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Otp from '@/models/otp';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import Transaction from '@/models/walletTransaction';
import { signToken } from '@/utils/jwt';
import { generateGamerName } from '@/utils/helpers';

const SIGNUP_BONUS = 10;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { mobileNumber, otp, deviceType } = body;

    if (!mobileNumber || !otp) {
      return NextResponse.json(
        { message: 'Mobile number and OTP are required' },
        { status: 400 }
      );
    }

    const otpRecord = await Otp.findOne({ mobileNumber });

    if (
      !otpRecord ||
      otpRecord.otp !== String(otp) ||
      otpRecord.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { message: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    let user = await User.findOne({ mobileNumber });
    let wallet;
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      user = await User.create({
        mobileNumber,
        username: generateGamerName(),
        status: 'active',
        deviceType: deviceType || 'unknown',
        lastLogin: new Date(),
      });

      wallet = await Wallet.create({
        userId: user._id,
        balance: 0,
        instantBonus: SIGNUP_BONUS,
        lockedBonus: 0,
      });

      await Transaction.create({
        walletId: wallet._id,
        type: 'bonus',
        status: 'completed',
        amount: {
          cashAmount: 0,
          instantBonus: SIGNUP_BONUS,
          lockedBonus: 0,
          gst: 0,
          tds: 0,
          otherDeductions: 0,
          total: SIGNUP_BONUS,
        },
        remark: 'Signup bonus',
        createdOn: new Date(),
        completedOn: new Date(),
      });

    } else {
      if (user.status !== 'active') {
        return NextResponse.json(
          { message: `Your account is ${user.status}. Please contact support.` },
          { status: 403 }
        );
      }

      await User.findByIdAndUpdate(user._id, {
        lastLogin: new Date(),
        deviceType: deviceType || user.deviceType,
      });

      wallet = await Wallet.findOne({ userId: user._id })
        .select('balance instantBonus lockedBonus')
        .lean()
        .exec();
    }

    const token = signToken({ userId: user._id.toString(), role: 'user' });

    await Otp.deleteOne({ mobileNumber });

    return NextResponse.json(
      {
        message: 'Login successful',
        token,
        userName: user.username,
        userId: user._id,
        wallet: {
          balance: wallet?.balance || 0,
          instantBonus: wallet?.instantBonus || 0,
          lockedBonus: wallet?.lockedBonus || 0,
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[OTP Verify Error]:', error.message);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
// /**
//  * @fileoverview Auth - Verify OTP & Login API (App Router)
//  * Validates OTP, creates/loads User, assigns signup bonus, and issues JWT.
//  * Path: POST /api/auth/otp/verify
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import Otp from '@/models/otp';
// import User from '@/models/user';
// import { signToken } from '@/utils/jwt';
// import { generateGamerName } from '@/utils/helpers';
// import { IWalletTransaction } from '@/utils/pokerModelTypes';

// export async function POST(request: NextRequest) {
//   try {
//     await dbConnect();

//     // 1. Extract Body & Headers
//     const body = await request.json();
//     const { mobileNumber, otp, latitude, longitude, deviceType } = body;

//     const ipAddress = request.headers.get('x-forwarded-for') || request.ip || 'Unknown IP';
//     const userAgent = request.headers.get('user-agent') || 'Unknown device';

//     // 2. Initial Validation
//     if (!mobileNumber || !otp) {
//       return NextResponse.json({ message: 'Mobile number and OTP are required' }, { status: 400 });
//     }

//     // 3. Verify OTP
//     const otpRecord = await Otp.findOne({ mobileNumber });
//     if (!otpRecord || otpRecord.otp !== String(otp) || otpRecord.expiresAt < new Date()) {
//       return NextResponse.json({ message: 'Invalid or expired OTP' }, { status: 400 });
//     }

//     // 4. Load or Create User
//     let user = await User.findOne({ mobileNumber });

//     if (!user) {
//       const username = generateGamerName();

//       // Enforce strict IWalletTransaction typing for the signup bonus
//       const initialTransaction: IWalletTransaction = {
//         createdOn: new Date(),
//         status: 'completed',
//         amount: {
//           cashAmount: 0,
//           instantBonus: 10,
//           lockedBonus: 0,
//           gst: 0,
//           tds: 0,
//           otherDeductions: 0,
//           total: 10
//         },
//         type: 'bonus',
//         remark: 'Game join bonus',
//       };

//       user = new User({
//         mobileNumber,
//         username,
//         wallet: {
//           balance: 0,
//           instantBonus: 10,
//           lockedBonus: 0,
//           transactions: [initialTransaction],
//         },
//         deviceInfo: userAgent,
//         ipAddress: ipAddress,
//         deviceType: deviceType || 'android',
//         latitude: latitude || null,
//         longitude: longitude || null,
//       });

//       await user.save();
//     } else {
//       // Reject disabled accounts
//       if (user.status !== 'active') {
//         return NextResponse.json({ message: `Your account is ${user.status}. Please contact support.` }, { status: 403 });
//       }

//       // Update Session Data (Replacing legacy decoupled req logic)
//       user.lastLogin = new Date();
//       user.ipAddress = ipAddress;
//       user.deviceInfo = userAgent;
//       if (latitude) user.latitude = latitude;
//       if (longitude) user.longitude = longitude;
      
//       await user.save();
//     }

//     // 5. Issue JWT & Cleanup
//     const token = signToken({ userId: user._id.toString(), role: user.role || 'user' });
//     await Otp.deleteOne({ mobileNumber });

//     // 6. Return Secure Payload
//     return NextResponse.json({ 
//       message: 'Login successful', 
//       token, 
//       userName: user.username, 
//       userId: user._id, 
//       wallet: {
//         balance: user.wallet.balance,
//         instantBonus: user.wallet.instantBonus,
//         lockedBonus: user.wallet.lockedBonus,
//       }
//     }, { status: 200 });

//   } catch (error: any) {
//     console.error('[Verify Login Error]:', error.message);
//     return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
//   }
// }