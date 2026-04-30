/**
 * @fileoverview Admin Poker Modes Collection API (App Router)
 * Handles fetching all modes (filtered by base pokerId) and creating new modes.
 * Path: GET /api/admin/pokerModes | POST /api/admin/pokerModes
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerMode from '@/models/pokerMode';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

interface JwtPayload { userId: string; role: string; }

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = (await verifyToken(token)) as JwtPayload;
    if (payload.role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // 2. Fetch Logic (Filtering by pokerId)
    const pokerId = request.nextUrl.searchParams.get('pokerId');
    if (!pokerId || !mongoose.Types.ObjectId.isValid(pokerId)) {
      return NextResponse.json({ message: 'Valid pokerId query parameter is required' }, { status: 400 });
    }

    const pokerModes = await PokerMode.find({ pokerId: new mongoose.Types.ObjectId(pokerId) }).lean().exec();
    
    return NextResponse.json(pokerModes, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch poker modes', error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = (await verifyToken(token)) as JwtPayload;
    if (payload.role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // 2. Extract Body and Create
    const body = await request.json();
    const newPokerMode = await PokerMode.create(body);
    
    return NextResponse.json(newPokerMode, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to create poker mode', error: error.message }, { status: 500 });
  }
}