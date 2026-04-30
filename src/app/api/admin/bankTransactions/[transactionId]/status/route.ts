/**
 * @fileoverview Admin Bank Transaction Status Update API (App Router)
 * Handles approval/rejection of deposits and withdrawals, calculating GST,
 * and safely updating user wallets using MongoDB ACID Transactions.
 * Path: PATCH /api/admin/bankTransactions/[transactionId]/status
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import BankTransaction from '@/models/bankTransaction';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { IWalletTransaction } from '@/utils/pokerModelTypes';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  // 1. Establish Database Connection
  await dbConnect();

  // 2. Start a MongoDB Session for ACID compliance
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Authentication & Authorization Check
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      throw new Error('AUTH_FAILED');
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      throw new Error('UNAUTHORIZED');
    }

    // 4. Validate Parameters & Body
    const { transactionId } = params;
    if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error('INVALID_ID');
    }

    const body = await request.json();
    const { newStatus } = body;

    if (!newStatus || !['pending', 'completed', 'failed'].includes(newStatus)) {
      throw new Error('INVALID_STATUS');
    }

    // 5. Fetch the Bank Transaction
    const transaction = await BankTransaction.findById(transactionId).session(session);
    if (!transaction) throw new Error('NOT_FOUND_TX');

    // Prevent redundant updates
    if (transaction.status === newStatus) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ message: 'Status is already set to ' + newStatus }, { status: 200 });
    }

    // 6. Financial Math (28% GST Logic)
    const mainAmount = transaction.amount;
    const cashAmount = Math.round((mainAmount / 1.28) * 100) / 100;
    const gstAmount = Math.round((mainAmount - cashAmount) * 100) / 100;
    const instantBonus = gstAmount;

    let balanceChange = 0;
    let walletTx: IWalletTransaction | null = null;

    // 7. Core Ledger Logic
    if (transaction.type === 'deposit') {
      if (['failed', 'pending'].includes(transaction.status) && newStatus === 'completed') {
        balanceChange = cashAmount + instantBonus;
        walletTx = createWalletTx(cashAmount, instantBonus, gstAmount, mainAmount, 'completed', 'deposit', 'Bank transaction completed');
      } else if (transaction.status === 'completed' && ['failed', 'pending'].includes(newStatus)) {
        balanceChange = -(cashAmount + instantBonus);
        walletTx = createWalletTx(-cashAmount, -instantBonus, -gstAmount, -mainAmount, 'reversed', 'withdraw', 'Bank transaction reverted');
      }
    } else if (transaction.type === 'withdraw') {
      if (['failed', 'pending'].includes(transaction.status) && newStatus === 'completed') {
        balanceChange = -(cashAmount + instantBonus);
        walletTx = createWalletTx(cashAmount, instantBonus, gstAmount, mainAmount, 'completed', 'withdraw', 'Bank transaction completed');
      } else if (transaction.status === 'completed' && ['failed', 'pending'].includes(newStatus)) {
        balanceChange = cashAmount + instantBonus;
        walletTx = createWalletTx(-cashAmount, -instantBonus, -gstAmount, -mainAmount, 'reversed', 'deposit', 'Bank transaction reverted');
      }
    }

    // 8. Execute Atomic User Update
    if (balanceChange !== 0 && walletTx) {
      const updateQuery: any = { $inc: { 'wallet.balance': balanceChange }, $push: { 'wallet.transactions': walletTx } };
      
      // If we are deducting balance, strictly ensure the user has enough to cover it
      const matchQuery = balanceChange < 0 
        ? { _id: transaction.userId, 'wallet.balance': { $gte: Math.abs(balanceChange) } }
        : { _id: transaction.userId };

      const updatedUser = await User.findOneAndUpdate(matchQuery, updateQuery, { new: true, session });
      
      if (!updatedUser) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
    }

    // 9. Update Transaction Status
    transaction.status = newStatus;
    await transaction.save({ session });

    // 10. Commit the ACID Transaction
    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ message: 'Transaction status updated successfully' }, { status: 200 });

  } catch (error: any) {
    // 11. Rollback on any failure
    await session.abortTransaction();
    session.endSession();

    console.error(`[Transaction Status Update Error - ${params.transactionId}]:`, error.message);
    
    // Error Mapping
    if (error.message === 'AUTH_FAILED') return NextResponse.json({ message: 'Authentication missing' }, { status: 401 });
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    if (error.message === 'INVALID_ID' || error.message === 'INVALID_STATUS') return NextResponse.json({ message: 'Bad Request' }, { status: 400 });
    if (error.message === 'NOT_FOUND_TX') return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    if (error.message === 'INSUFFICIENT_FUNDS') return NextResponse.json({ message: 'User has insufficient balance for this reversal/withdrawal' }, { status: 400 });

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to generate standard wallet transaction payloads
function createWalletTx(
  cashAmount: number, 
  instantBonus: number, 
  gst: number, 
  total: number, 
  status: 'failed' | 'completed' | 'pending' | 'reversed', // Note: Added 'reversed' to match your logic
  type: 'deposit' | 'withdraw' | 'deskIn' | 'deskWithdraw' | 'bonus', 
  remark: string
): IWalletTransaction {
  return {
    amount: { cashAmount, instantBonus, lockedBonus: 0, gst, tds: 0, otherDeductions: 0, total },
    status: status as any, // We must cast to any here because your IWalletTransaction interface is missing 'reversed'
    type,
    remark,
    createdOn: new Date(),
    completedOn: new Date(),
  };
}

// // Helper to generate standard wallet transaction payloads
// function createWalletTx(cashAmount: number, instantBonus: number, gst: number, total: number, status: string, type: string, remark: string): IWalletTransaction {
//   return {
//     amount: { cashAmount, instantBonus, lockedBonus: 0, gst, tds: 0, otherDeductions: 0, total },
//     status,
//     type: type as any,
//     remark,
//     createdOn: new Date(),
//     completedOn: new Date(),
//   };
// }