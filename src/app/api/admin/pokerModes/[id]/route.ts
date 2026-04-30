/**
 * @fileoverview Admin Single Poker Mode API (App Router)
 * Handles fetching, updating, and deleting a specific game mode instance.
 * Path: /api/admin/pokerModes/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerMode from '@/models/pokerMode';
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

    const pokerMode = await PokerMode.findById(params.id).lean().exec();
    if (!pokerMode) return NextResponse.json({ message: 'Poker mode not found' }, { status: 404 });
    
    return NextResponse.json(pokerMode, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to fetch poker mode' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    await validateAccessAndId(params.id);
    const body = await request.json();

    const updatedPokerMode = await PokerMode.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!updatedPokerMode) return NextResponse.json({ message: 'Poker mode not found' }, { status: 404 });

    return NextResponse.json(updatedPokerMode, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to update poker mode' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    await validateAccessAndId(params.id);

    const deletedPokerMode = await PokerMode.findByIdAndDelete(params.id);
    if (!deletedPokerMode) return NextResponse.json({ message: 'Poker mode not found' }, { status: 404 });

    return NextResponse.json({ message: 'Poker mode deleted successfully' }, { status: 200 });
  } catch (err: any) {
    if (['401', '403', '400'].includes(err.message)) return NextResponse.json({ error: err.message }, { status: parseInt(err.message) });
    return NextResponse.json({ message: 'Failed to delete poker mode' }, { status: 500 });
  }
}