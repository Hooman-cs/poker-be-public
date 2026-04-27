import dbConnect from '../../../config/dbConnect';
import Poker from '../../../models/poker';

export default async function handler(req, res) {
  await dbConnect();

  try {
    if (req.method === 'GET') {
      const pokers = await Poker.find({}); // Fetch all poker entries
      return res.status(200).json(pokers);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
