/**
 * @fileoverview Admin Bank Transactions List API Route (App Router)
 * Fetches, filters, and paginates bank transactions (deposits/withdrawals) for the admin dashboard.
 * Path: GET /api/admin/bankTransactions
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import BankTransaction from '@/models/bankTransaction';
import User from '@/models/user';
import BankAccount from '@/models/bankAccount';
import mongoose from 'mongoose';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';

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

export async function GET(request: NextRequest) {
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

    // 3. Parse URL Search Parameters
    const searchParams = request.nextUrl.searchParams;
    const pageNumber = parseInt(searchParams.get('page') || '1', 10);
    const pageLimit = parseInt(searchParams.get('limit') || '10', 10);
    
    const bankId = searchParams.get('bankId');
    const username = searchParams.get('username');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const maxAmount = searchParams.get('maxAmount');
    const sortByDate = searchParams.get('sortByDate');

    // 4. Construct Query Filters
    const filters: Record<string, any> = {};

    if (bankId) {
      if (!mongoose.Types.ObjectId.isValid(bankId)) {
        return NextResponse.json({ message: 'Invalid bankId format' }, { status: 400 });
      }
      filters.bankId = bankId;
    }

    if (status) filters.status = status;
    if (type) filters.type = type;
    if (maxAmount) filters.amount = { $lte: Number(maxAmount) };

    // FIX: To filter by a populated username, we must fetch the matching user IDs first.
    if (username) {
      const matchingUsers = await User.find({ 
        username: { $regex: username, $options: 'i' } 
      }).select('_id').lean().exec();
      
      const userIds = matchingUsers.map(user => user._id);
      filters.userId = { $in: userIds };
    }

    // 5. Determine Sorting
    const sortOptions: Record<string, 1 | -1> = {};
    if (sortByDate === 'desc') {
      sortOptions.createdOn = -1;
    } else {
      sortOptions.createdOn = 1;
    }

    // 6. Execute Queries in Parallel
    const [transactions, totalCounts] = await Promise.all([
      BankTransaction.find(filters)
        .skip((pageNumber - 1) * pageLimit)
        .limit(pageLimit)
        .sort(sortOptions)
        .populate({ path: 'userId', model: User, select: 'username mobileNumber' })
        .populate({ path: 'bankId', model: BankAccount, select: 'accountNumber bankName' })
        .lean()
        .exec(),
      BankTransaction.countDocuments(filters).exec()
    ]);

    // 7. Return Payload
    return NextResponse.json({
      transactions,
      totalCounts,
      totalPages: Math.ceil(totalCounts / pageLimit),
      currentPage: pageNumber,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Bank Transactions API Error]:', error.message);
    return NextResponse.json({ message: 'Failed to fetch transactions' }, { status: 500 });
  }
}