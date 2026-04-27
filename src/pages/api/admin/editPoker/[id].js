// File: pages/api/poker/[id].js

import dbConnect from '../../../../config/dbConnect';
import Poker from '../../../../models/poker'

export default async function handler(req, res) {
  await dbConnect();

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const poker = await Poker.findByIdAndUpdate(id, req.body, { new: true });
      if (!poker) {
        return res.status(404).json({ error: 'Poker game not found.' });
      }
      return res.status(200).json(poker);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update poker game.' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
