/**
 * @fileoverview User Wallet Transactions API (App Router)
 * Fetches paginated transaction history using a MongoDB Aggregation Pipeline for maximum performance.
 * Path: GET /api/user/wallet/transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import mongoose from 'mongoose';

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
    let status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Normalize legacy 'successful' to strict 'completed' type
    if (status === 'successful') status = 'completed';

    // 3. Validate Enums against our Global Types
    const validTypes = ['deposit', 'withdraw', 'deskIn', 'deskWithdraw', 'bonus', 'pgDeposit'];
    const validStatuses = ['failed', 'completed', 'pending', 'reversed'];

    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ message: `Invalid type. Valid types are: ${validTypes.join(', ')}` }, { status: 400 });
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // 4. Construct Aggregation Match Pipeline
    const matchStage: any = {
      'wallet.transactions.createdOn': {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    };
    if (type) matchStage['wallet.transactions.type'] = type;
    if (status) matchStage['wallet.transactions.status'] = status;

    const skip = (page - 1) * limit;

    // 5. Execute MongoDB Aggregation Pipeline
    const aggregationResult = await User.aggregate([
      // A. Find the specific user
      { $match: { _id: new mongoose.Types.ObjectId(decoded.userId) } },
      
      // B. Unwind the transactions array so we can filter individual items natively
      { $unwind: '$wallet.transactions' },
      
      // C. Filter the unrolled transactions based on query params
      { $match: matchStage },
      
      // D. Sort newest first
      { $sort: { 'wallet.transactions.createdOn': -1 } },
      
      // E. Facet to get both total count and paginated data simultaneously
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    // 6. Format Payload
    const totalTransactions = aggregationResult[0]?.metadata[0]?.total || 0;
    const transactions = aggregationResult[0]?.data.map((item: any) => item.wallet.transactions) || [];

    return NextResponse.json({
      message: 'Transactions fetched successfully',
      transactions,
      page,
      limit,
      totalTransactions,
      totalPages: Math.ceil(totalTransactions / limit),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Fetch Transactions Error]:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}