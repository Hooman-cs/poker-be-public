/**
 * @fileoverview Admin User Status Update API Route (App Router)
 * Handles updating a user's account status (active, inactive, suspended).
 * Path: PATCH /api/admin/users/[userId]/status
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    // 3. Validate Dynamic Parameter
    const { userId } = params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'Invalid User ID' }, { status: 400 });
    }

    // 4. Extract and Validate Body Payload
    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided.' }, { status: 400 });
    }

    // 5. Perform Update
    const user = await User.findByIdAndUpdate(
      userId, 
      { status }, 
      { new: true, runValidators: true }
    ).select('-password -__v').exec();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // 6. Return Success
    return NextResponse.json({ message: 'User status updated successfully', user }, { status: 200 });

  } catch (error: any) {
    console.error(`[User Status Update API Error - User ${params.userId}]:`, error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}