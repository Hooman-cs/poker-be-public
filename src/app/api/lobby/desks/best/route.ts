/**
 * @fileoverview Client Lobby - Find Best Desk API Route (App Router)
 * Determines the optimal active poker table for a player based on occupancy rules.
 * Path: GET /api/lobby/desks/best
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerDesk from '@/models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import mongoose from 'mongoose';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

interface IPopulatedSeat {
  userId: {
    _id: mongoose.Types.ObjectId;
    username: string;
  } | null;
  seatNumber: number;
  buyInAmount: number;
  balanceAtTable: number;
  status: 'active' | 'disconnected' | 'sittingOut';
}

interface IPopulatedDesk {
  _id: mongoose.Types.ObjectId;
  pokerModeId: mongoose.Types.ObjectId;
  tableName: string;
  maxSeats: number;
  minBuyIn: number;
  maxBuyIn: number;
  seats: IPopulatedSeat[];
  observers: mongoose.Types.ObjectId[];
}

// -----------------------------------------------------------------------------
// Route Handler
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Client Authentication Check (Bearer Token)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is required' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // 3. Extract and Validate Query Parameters
    const pokerModeId = request.nextUrl.searchParams.get('pokerModeId');
    if (!pokerModeId || !mongoose.Types.ObjectId.isValid(pokerModeId)) {
      return NextResponse.json({ message: 'Valid Poker Mode ID is required' }, { status: 400 });
    }

    // 4. Fetch Active Poker Desks (Optimized with .lean())
    const pokerDesks = (await PokerDesk.find({ 
      pokerModeId: new mongoose.Types.ObjectId(pokerModeId),
      status: 'active' // Ensuring we only route players to active tables
    })
      .populate('seats.userId', 'username')
      .lean()
      .exec()) as unknown as IPopulatedDesk[];

    if (pokerDesks.length === 0) {
      return NextResponse.json({ message: 'No active poker desks available for the specified mode' }, { status: 404 });
    }

    // 5. Matchmaking Logic: Find the optimal desk
    // Rule: Prefer tables that are active (>0 seats) but not crowded (<= 75% full)
    const sortedDesks = pokerDesks
      .filter((desk) => {
        const activeSeatsCount = desk.seats.length;
        return activeSeatsCount > 0 && activeSeatsCount <= (desk.maxSeats * 0.75);
      })
      .sort((a, b) => {
        if (a.seats.length !== b.seats.length) {
          return a.seats.length - b.seats.length; // Ascending by seat count
        }
        return a.observers.length - b.observers.length; // Fallback: ascending by observer count
      });

    // Fallback to the first available desk if no desks match the optimal criteria
    const bestDesk = sortedDesks[0] || pokerDesks[0];

    // 6. Format Seat Data safely
    const formattedSeats = bestDesk.seats
      .filter((seat) => seat.userId !== null) // Strip empty seats
      .map((seat) => ({
        userId: seat.userId!._id.toString(),
        username: seat.userId!.username,
        seatNumber: seat.seatNumber,
        buyInAmount: seat.buyInAmount,
        balanceAtTable: seat.balanceAtTable,
        status: seat.status || 'active',
      }));

    // 7. Return Matchmaking Payload
    return NextResponse.json({
      id: bestDesk._id,
      seats: formattedSeats,
      pokerModeId: bestDesk.pokerModeId,
      tableName: bestDesk.tableName,
      maxSeats: bestDesk.maxSeats,
      minBuyIn: bestDesk.minBuyIn,
      maxBuyIn: bestDesk.maxBuyIn,
      message: 'Best table found successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Find Best Desk API Error]:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}