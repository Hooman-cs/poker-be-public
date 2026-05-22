/**
 * @fileoverview Admin PMG (Payment Gateway) Transactions API Route
 * Handles fetching, filtering, and paginating payment gateway logs.
 * Path: GET /api/admin/pmgTransactions
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PMGTransaction from '@/models/gatewayTransaction';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

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

    // 3. Parse URL Search Parameters (Replacing legacy req.body)
    const searchParams = request.nextUrl.searchParams;
    const pageNumber = parseInt(searchParams.get('page') || '1', 10);
    const pageLimit = parseInt(searchParams.get('limit') || '10', 10);
    
    const username = searchParams.get('username');
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');

    // 4. Construct Query Filters
    const filters: Record<string, any> = {};

    if (orderId) {
      filters.orderId = orderId;
    }

    if (status) {
      const validStatuses = ['created', 'successful', 'failed', 'pending'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ message: 'Invalid status value' }, { status: 400 });
      }
      filters.status = status;
    }

    // Resolve username to a User ID reference before querying transactions
    if (username) {
      const user = await User.findOne({ username }).select('_id').lean().exec();
      if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      filters.userId = user._id;
    }

    // 5. Execute Queries Concurrently
    const [transactions, totalTransactions] = await Promise.all([
      PMGTransaction.find(filters)
        .skip((pageNumber - 1) * pageLimit)
        .limit(pageLimit)
        .populate({ path: 'userId', model: User, select: 'username' })
        .lean()
        .exec(),
      PMGTransaction.countDocuments(filters).exec()
    ]);

    // 6. Return Payload
    return NextResponse.json({
      transactions,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalTransactions / pageLimit),
      totalTransactions,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[PMG Transactions API Error]:', error.message);
    return NextResponse.json({ message: 'Failed to fetch PMG transactions' }, { status: 500 });
  }
}