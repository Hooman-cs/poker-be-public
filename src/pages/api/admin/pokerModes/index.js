 
import  dbConnect  from '../../../../config/dbConnect';
import PokerMode from '../../../../models/pokerMode';

export default async function handler(req, res) {
  const { method, query } = req;
  const { pokerId } = query;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const pokerModes = await PokerMode.find({ pokerId });
        res.status(200).json(pokerModes);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch poker modes', error });
      }
      break;

    case 'POST':
      try {
        const newPokerMode = await PokerMode.create(req.body);
        res.status(201).json(newPokerMode);
      } catch (error) {
        res.status(500).json({ message: 'Failed to create poker mode', error });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
