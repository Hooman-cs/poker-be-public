/**
 * @fileoverview Admin Single Poker Table API Route (App Router)
 * Path: /api/admin/poker/[id]
 * Currently handles: DELETE
 * Future: Will handle PUT/PATCH for editing.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
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
// Route Handlers
// -----------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // 3. Validate ID Parameter
    const { id } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid Poker Game ID' }, { status: 400 });
    }

    // 4. Perform Deletion
    const poker = await Poker.findByIdAndDelete(id);
    
    if (!poker) {
      return NextResponse.json({ message: 'Poker game not found' }, { status: 404 });
    }

    // 5. Return Success
    return NextResponse.json({ message: 'Poker game deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[Delete Poker API Error - ${params.id}]:`, error.message);
    return NextResponse.json({ error: 'Failed to delete poker game' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT: Update an existing Poker Table
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // 3. Validate ID Parameter
    const { id } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid Poker Game ID' }, { status: 400 });
    }

    // 4. Extract Payload
    const body = await request.json();

    // 5. Perform Update (runValidators ensures the new data strictly matches the Schema)
    const poker = await Poker.findByIdAndUpdate(id, body, { 
      new: true, 
      runValidators: true 
    });
    
    if (!poker) {
      return NextResponse.json({ message: 'Poker game not found' }, { status: 404 });
    }

    // 6. Return Updated Payload
    return NextResponse.json(poker, { status: 200 });

  } catch (error: any) {
    console.error(`[Edit Poker API Error - ${params.id}]:`, error.message);
    
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: 'Invalid data provided', details: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update poker game' }, { status: 500 });
  }
}