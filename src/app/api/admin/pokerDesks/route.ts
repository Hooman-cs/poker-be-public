
/**
 * @fileoverview Admin Poker Desks Collection API (App Router)
 * Handles listing tables (filtered by Mode) and creating new tables with inherited properties.
 * Path: /api/admin/pokerDesks
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerDesk from '@/models/pokerDesk';
import PokerMode from '@/models/pokerMode';
import Poker from '@/models/poker';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { IPokerMode, IPoker } from '@/utils/pokerModelTypes';
import pokerMode from '@/models/pokerMode';

interface JwtPayload { userId: string; role: string; }

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = (await verifyToken(token)) as JwtPayload;
    if (payload.role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // 2. Fetch Logic
    const pokerModeId = request.nextUrl.searchParams.get('pokerModeId');
    if (!pokerModeId) {
      return NextResponse.json({ message: 'PokerModeId query parameter is required' }, { status: 400 });
    }

    const pokerDesks = await PokerDesk.find({ pokerModeId }).lean().exec();
    return NextResponse.json(pokerDesks, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch poker desks', error: error.message }, { status: 500 });
  }
}

// export async function POST(request: NextRequest) {
    
//   try {
//     await dbConnect();

//     // 1. Auth Check
//     const token = cookies().get('token')?.value;
//     if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
//     const payload = (await verifyToken(token)) as JwtPayload;
//     if (payload.role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

//     // 2. Extract Body
//     const body = await request.json();
//     if (!body.pokerModeId) return NextResponse.json({ message: 'pokerModeId is required' }, { status: 400 });

//     // 3. Inherit Properties from Mode and Core Game
//     // const pokerMode = await PokerMode.findById(body.pokerModeId).lean().exec();
//     const pokerMode = (await PokerMode.findById(body.pokerModeId).lean().exec()) as unknown as IPokerMode;
//     if (!pokerMode) return NextResponse.json({ message: 'PokerMode not found' }, { status: 404 });

//     const pokerGame = await Poker.findById(pokerMode.pokerId).lean().exec();
//     if (!pokerGame) return NextResponse.json({ message: 'Base PokerGame not found' }, { status: 404 });

//     // 4. Construct and Create
//     const newPokerDeskData = {
//       ...body,
//       stake: pokerMode.stake,
//       minBuyIn: pokerMode.minBuyIn,
//       maxBuyIn: pokerMode.maxBuyIn,
//       bType: pokerMode.bType,
//       minPlayerCount: pokerMode.maxPlayerCount, // Note: Inheriting max into min as per legacy logic
//       blindsOrAntes: pokerMode.blindsOrAntes,
//       status: pokerMode.status,
//       gameType: pokerGame.gameType,
//       mode: pokerMode.mode,
//     };

//     const newPokerDesk = await PokerDesk.create(newPokerDeskData);
//     return NextResponse.json(newPokerDesk, { status: 201 });

//   } catch (error: any) {
//     return NextResponse.json({ message: 'Failed to create poker desk', error: error.message }, { status: 500 });
//   }
// }
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Auth Check
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = (await verifyToken(token)) as JwtPayload;
    if (payload.role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // 2. Extract Body
    const body = await request.json();
    if (!body.pokerModeId) return NextResponse.json({ message: 'pokerModeId is required' }, { status: 400 });

    // 3. Inherit Properties from Mode and Core Game
    // Cast explicitly to single objects, not arrays
    const pokerMode = (await PokerMode.findById(body.pokerModeId).lean().exec()) as IPokerMode | null;
    if (!pokerMode) return NextResponse.json({ message: 'PokerMode not found' }, { status: 404 });

    const pokerGame = (await Poker.findById(pokerMode.pokerId).lean().exec()) as IPoker | null;
    if (!pokerGame) return NextResponse.json({ message: 'Base PokerGame not found' }, { status: 404 });

    // 4. Construct and Create
    // Removed ghost fields (maxPlayerCount, blindsOrAntes) that don't exist in the Mode schema
    const newPokerDeskData = {
      ...body,
      stake: pokerMode.stake,
      minBuyIn: pokerMode.minBuyIn,
      maxBuyIn: pokerMode.maxBuyIn,
      bType: pokerMode.bType,
      status: pokerMode.status,
      gameType: pokerGame.gameType,
      mode: pokerMode.mode,
    };

    const newPokerDesk = await PokerDesk.create(newPokerDeskData);
    return NextResponse.json(newPokerDesk, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to create poker desk', error: error.message }, { status: 500 });
  }
}