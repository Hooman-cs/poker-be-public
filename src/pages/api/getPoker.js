// pages/api/getAllPokers.ts
import dbConnect from '@/config/dbConnect';
import Poker from '../../models/poker';
import { verifyToken } from '../../utils/jwt';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token is required' });
    }

    const decoded = verifyToken(token);
    console.log(decoded);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    try {
      const pokers = await Poker.find({ status: { $in: ['active', 'maintenance'] } }, 'name rules description objective blindsOrAntes')
        .exec();
       console.log(pokers);
      // Map over the results to return only required details
      const pokerDetails = pokers.map(poker => ({
        pokerId: poker._id,
        name: poker.name,
        rules: poker.rules,
        status : poker.status,
        description: poker.description,
        objective: poker.objective,
        blindsOrAntes: poker.blindsOrAntes
      }));

      res.status(200).json(pokerDetails);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
