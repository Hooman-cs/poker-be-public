/**
 * @fileoverview Admin User Balance Management API Route (App Router)
 * Handles adding or removing locked bonus funds securely using Atomic DB operations.
 * Path: POST /api/admin/users/[userId]/balance
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { IWalletTransaction, IAmountBreakdown } from '@/utils/pokerModelTypes';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

interface JwtPayload {
  userId: string;
  role: string;
}

// -----------------------------------------------------------------------------
// Route Handler
// -----------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Authentication & Authorization Check
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Validate Dynamic Parameter
    const { userId } = params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'Invalid User ID' }, { status: 400 });
    }

    // 4. Extract and Validate Body Payload
    const body = await request.json();
    const { bonusAmount, remark, action } = body;

    if (!bonusAmount || bonusAmount <= 0) {
      return NextResponse.json({ message: 'Invalid amount. Must be a positive number.' }, { status: 400 });
    }

    if (!remark || typeof remark !== 'string' || remark.trim().length === 0) {
      return NextResponse.json({ message: 'A remark/reason is required.' }, { status: 400 });
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ message: 'Invalid action. Must be "add" or "remove".' }, { status: 400 });
    }

    // 5. Construct the Ledger Transaction Object
    const amountBreakdown: IAmountBreakdown = {
      cashAmount: 0,
      instantBonus: 0,
      lockedBonus: bonusAmount,
      gst: 0,
      tds: 0,
      otherDeductions: 0,
      total: bonusAmount,
    };

    const walletTransaction: IWalletTransaction = {
      status: 'completed',
      amount: amountBreakdown,
      type: 'bonus',
      remark,
      createdOn: new Date(),
      completedOn: new Date(),
    };

    // 6. Execute Atomic Database Update (Prevents Race Conditions)
    let updatedUser;

    if (action === 'add') {
      // Safely increment balance and push transaction in one mathematical step
      updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        { 
          $inc: { 'wallet.lockedBonus': bonusAmount },
          $push: { 'wallet.transactions': walletTransaction }
        },
        { new: true }
      ).select('-password -__v').exec();
    } else if (action === 'remove') {
      // Query ensures the user actually has enough balance before removing it!
      updatedUser = await User.findOneAndUpdate(
        { _id: userId, 'wallet.lockedBonus': { $gte: bonusAmount } },
        { 
          $inc: { 'wallet.lockedBonus': -bonusAmount },
          $push: { 'wallet.transactions': walletTransaction }
        },
        { new: true }
      ).select('-password -__v').exec();

      if (!updatedUser) {
        return NextResponse.json({ message: 'Insufficient locked bonus to remove the specified amount.' }, { status: 400 });
      }
    }

    if (!updatedUser) {
      return NextResponse.json({ message: 'User not found or update failed.' }, { status: 404 });
    }

    // 7. Return Success
    return NextResponse.json({ message: `Amount ${action}ed successfully`, user: updatedUser }, { status: 200 });

  } catch (error: any) {
    console.error(`[Balance Update API Error - User ${params.userId}]:`, error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}