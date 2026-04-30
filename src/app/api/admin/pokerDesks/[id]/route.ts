/**
 * @fileoverview Admin Single Poker Desk API (App Router)
 * Handles fetching, updating, and deleting a specific table instance.
 * Path: /api/admin/pokerDesks/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerDesk from '@/models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

interface JwtPayload { userId: string; role: string; }

// Helper for Auth & Validation
async function validateAccessAndId(id: string) {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('401');
  const payload = (await verifyToken(token)) as JwtPayload;
  if (payload.role !== 'superadmin') throw new Error('403');
  if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new Error('400');
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    await validateAccessAndId(params.id);

    const pokerDesk = await PokerDesk.findById(params.id).lean().exec();
    if (!pokerDesk) return NextResponse.json({ message: 'Poker desk not found' }, { status: 404 });
    
    return NextResponse.json(pokerDesk, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to fetch poker desk' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    await validateAccessAndId(params.id);
    const body = await request.json();

    const updatedPokerDesk = await PokerDesk.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!updatedPokerDesk) return NextResponse.json({ message: 'Poker desk not found' }, { status: 404 });

    return NextResponse.json(updatedPokerDesk, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to update poker desk' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    await validateAccessAndId(params.id);

    const deletedPokerDesk = await PokerDesk.findByIdAndDelete(params.id);
    if (!deletedPokerDesk) return NextResponse.json({ message: 'Poker desk not found' }, { status: 404 });

    return NextResponse.json({ message: 'Poker desk deleted successfully' }, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to delete poker desk' }, { status: 500 });
  }
}