/**
 * @fileoverview Admin Poker Creation API Route (App Router)
 * Handles the creation of new core Poker configurations.
 * Path: POST /api/admin/poker
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
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

// -----------------------------------------------------------------------------
// GET: Fetch all Poker Tables
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

    // 3. Fetch Data (using .lean() for massive performance boost on read-only queries)
    const pokers = await Poker.find({}).lean().exec();

    // 4. Return Payload
    return NextResponse.json(pokers, { status: 200 });

  } catch (error: any) {
    console.error('[Get Poker API Error]:', error.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Authentication & Authorization Check (Securing the endpoint)
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Authentication token is missing' },
        { status: 401 }
      );
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json(
        { message: 'Unauthorized access. Superadmin privileges required.' },
        { status: 403 }
      );
    }

    // 3. Extract Payload
    // Next.js 14 requires awaiting the JSON extraction
    const body = await request.json();

    // Note: Mongoose will inherently validate 'body' against the Poker schema
    // 4. Create Database Entry
    const poker = await Poker.create(body);

    // 5. Return Success Payload
    return NextResponse.json(poker, { status: 201 });

  } catch (error: any) {
    console.error('[Create Poker API Error]:', error.message);
    
    // Check if it's a Mongoose validation error to provide a better response
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Invalid data provided', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create poker game.' },
      { status: 500 }
    );
  }
}