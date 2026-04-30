/**
 * @fileoverview User Wallet API (App Router)
 * Fetches the current balances of the authenticated user.
 * Path: GET /api/user/wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import { verifyToken } from '@/utils/jwt';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ message: 'Authorization token required' }, { status: 401 });

    const decoded = (await verifyToken(token)) as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

    // 2. Fetch Wallet Balances (Optimized with .lean() and projection)
    const userData = await User.findById(decoded.userId)
      .select({
        'wallet.balance': 1,
        'wallet.instantBonus': 1,
        'wallet.lockedBonus': 1,
      })
      .lean()
      .exec();

    if (!userData || !userData.wallet) {
      return NextResponse.json({ message: 'User or wallet not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Wallet fetched successfully',
      wallet: userData.wallet,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Fetch Wallet Error]:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}