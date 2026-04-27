// File: pages/api/poker/index.js

import dbConnect from '../../../config/dbConnect';
import Poker from '../../../models/poker';

export default async function handler(req, res) {
  await dbConnect();
  if (req.method === 'POST') {
    try {
      const poker = await Poker.create(req.body);
      return res.status(201).json(poker);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to create poker game.' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
