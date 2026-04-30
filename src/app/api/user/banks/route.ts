/**
 * @fileoverview User Bank Accounts API (App Router)
 * Handles fetching paginated bank accounts and securely adding new ones.
 * Path: /api/user/banks
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import BankAccount from '@/models/bankAccount';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Pagination Extraction
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // 3. Fetch Data (Optimized)
    const [bankAccounts, totalBankAccounts] = await Promise.all([
      BankAccount.find({ userId: decoded.userId }).skip(skip).limit(limit).lean().exec(),
      BankAccount.countDocuments({ userId: decoded.userId }).exec()
    ]);

    return NextResponse.json({
      bankAccounts,
      totalPages: Math.ceil(totalBankAccounts / limit),
      currentPage: page,
      totalBankAccounts,
    }, { status: 200 });

  } catch (error: any) {
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

    // 2. Validation
    const { accountNumber, bankName, ifscCode, accountHolderName, isDefault = false } = await request.json();

    if (!accountNumber || !bankName || !ifscCode || !accountHolderName) {
      return NextResponse.json({ message: 'All banking fields are required' }, { status: 400 });
    }

    const user = await User.findById(decoded.userId).select('status').lean().exec();
    if (!user || user.status !== 'active') {
      return NextResponse.json({ message: 'Account is suspended or not found' }, { status: 403 });
    }

    // 3. Handle Default Accounts (Safely)
    if (isDefault) {
      await BankAccount.updateMany(
        { userId: decoded.userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    // 4. Create Account
    const newBankAccount = await BankAccount.create({
      userId: decoded.userId,
      accountNumber,
      bankName,
      ifscCode,
      accountHolderName,
      isDefault,
    });

    return NextResponse.json({ message: 'Bank account added successfully', bankAccount: newBankAccount }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
  }
}