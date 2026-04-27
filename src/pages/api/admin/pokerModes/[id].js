 
import dbConnect  from '../../../../config/dbConnect';
import PokerMode from '../../../../models/pokerMode';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const pokerModes = await PokerMode.find({ pokerId });
        if (!pokerModes.length) {
          return res.status(404).json({ message: 'Poker modes not found' });
        }
        res.status(200).json(pokerModes);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch poker modes', error });
      }
      break;
    case 'PUT':
      try {
        const updatedPokerMode = await PokerMode.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedPokerMode) {
          return res.status(404).json({ message: 'Poker mode not found' });
        }
        res.status(200).json(updatedPokerMode);
      } catch (error) {
        res.status(500).json({ message: 'Failed to update poker mode', error });
      }
      break;

    case 'DELETE':
      try {
        const deletedPokerMode = await PokerMode.findByIdAndDelete(id);
        if (!deletedPokerMode) {
          return res.status(404).json({ message: 'Poker mode not found' });
        }
        res.status(204).end();
      } catch (error) {
        res.status(500).json({ message: 'Failed to delete poker mode', error });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
