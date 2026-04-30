/**
 * @fileoverview User Bank Transaction Request API (App Router)
 * Allows users to submit manual deposit receipts or request withdrawals.
 * Path: POST /api/user/banks/transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import BankTransaction from '@/models/bankTransaction';
import BankAccount from '@/models/bankAccount';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import { IPopulatedBankTransaction } from '@/utils/pokerModelTypes';

// -----------------------------------------------------------------------------
// GET: Fetch Bank Transaction History
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Authorization token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Extract Query Parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '1970-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // 3. Validate Enums
    const validTypes = ['deposit', 'withdraw'];
    const validStatuses = ['failed', 'completed', 'successful', 'waiting', 'pending'];

    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ message: `Invalid type. Allowed: ${validTypes.join(', ')}` }, { status: 400 });
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ message: `Invalid status. Allowed: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // 4. Construct Query
    const query: any = {
      userId: decoded.userId,
      createdOn: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    if (type) query.type = type;
    if (status) query.status = status;

    // 5. Fetch Data (Optimized with .lean())
    const [bankTransactions, totalBankTransactions] = await Promise.all([
      BankTransaction.find(query)
        .populate({
          path: 'bankId',
          select: 'accountNumber bankName ifscCode accountHolderName',
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as unknown as IPopulatedBankTransaction[],
      BankTransaction.countDocuments(query).exec()
    ]);

    // 6. Format Payload for the Client
    const formattedTransactions = bankTransactions.map((tx) => ({
      id: tx._id,
      createdOn: tx.createdOn,
      status: tx.status,
      amount: tx.amount,
      type: tx.type,
      remark: tx.remark,
      imageUrl: tx.imageUrl,
      bankAccount: tx.bankId ? {
        accountNumber: tx.bankId.accountNumber,
        bankName: tx.bankId.bankName,
        ifscCode: tx.bankId.ifscCode,
        accountHolderName: tx.bankId.accountHolderName,
      } : null,
    }));

    return NextResponse.json({
      bankTransactions: formattedTransactions,
      totalPages: Math.ceil(totalBankTransactions / limit),
      currentPage: page,
      totalBankTransactions,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Fetch Bank Transactions Error]:', error.message);
    return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Extract Body
    const body = await request.json();
    const { bankId, amount, type, remark, imageUrl } = body;

    // 3. Strict Validation & Logic Flow
    if (!bankId || !amount || !type || amount <= 0) {
      return NextResponse.json({ message: 'Valid Bank ID, positive amount, and type are required' }, { status: 400 });
    }

    const validTypes = ['deposit', 'withdraw'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ message: `Invalid type. Allowed: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // A manual deposit requires a receipt image to prove the transfer.
    if (type === 'deposit' && !imageUrl) {
      return NextResponse.json({ message: 'A receipt image is required for manual deposits' }, { status: 400 });
    }

    // 4. Validate User & Financial Integrity
    const user = await User.findById(decoded.userId).select('status wallet.balance').lean().exec();
    if (!user || user.status !== 'active') {
      return NextResponse.json({ message: 'User not found or suspended' }, { status: 403 });
    }

    // CRITICAL PATCH: Prevent users from requesting more money than they have.
    if (type === 'withdraw' && user.wallet.balance < amount) {
      return NextResponse.json({ message: 'Insufficient wallet balance for this withdrawal' }, { status: 400 });
    }

    // 5. Validate Bank Link
    const bankAccount = await BankAccount.findOne({ _id: bankId, userId: decoded.userId }).lean().exec();
    if (!bankAccount) {
      return NextResponse.json({ message: 'Invalid bank account. Please link this account first.' }, { status: 400 });
    }

    // 6. Create Transaction Request
    // Note: We leave imageUrl undefined for withdrawals instead of saving garbage data.
    const transaction = await BankTransaction.create({
      userId: decoded.userId,
      bankId,
      amount,
      type,
      remark: remark || `${type} request`,
      imageUrl: type === 'deposit' ? imageUrl : undefined, 
      createdOn: new Date(),
      status: 'pending',
    });

    return NextResponse.json({ message: 'Transaction request submitted successfully', transaction }, { status: 201 });

  } catch (error: any) {
    console.error('[Bank Transaction Error]:', error.message);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}