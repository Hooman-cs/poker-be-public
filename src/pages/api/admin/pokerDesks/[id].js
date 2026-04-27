import dbConnect from '../../../../config/dbConnect';
import PokerDesk from '../../../../models/pokerDesk';

export default async function handler(req, res) {
  const { method, query, body } = req;
  const { id, pokerModeId } = query;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        // If `id` is provided, fetch a specific poker desk
        if (id) {
          const pokerDesk = await PokerDesk.findById(id);
          if (!pokerDesk) {
            return res.status(404).json({ message: 'Poker desk not found' });
          }
          return res.status(200).json(pokerDesk);
        }

        // Otherwise, fetch poker desks by `pokerModeId`
        if (pokerModeId) {
          const pokerDesks = await PokerDesk.find({ pokerModeId });
          if (!pokerDesks.length) {
            return res.status(404).json({ message: 'Poker desks not found' });
          }
          return res.status(200).json(pokerDesks);
        }

        return res.status(400).json({ message: 'PokerModeId query parameter is required' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch poker desks', error });
      }
      break;

    case 'PUT':
      try {
        if (!id) {
          return res.status(400).json({ message: 'ID is required for updating' });
        }

        const updatedPokerDesk = await PokerDesk.findByIdAndUpdate(id, body, { new: true });
        if (!updatedPokerDesk) {
          return res.status(404).json({ message: 'Poker desk not found' });
        }
        res.status(200).json(updatedPokerDesk);
      } catch (error) {
        res.status(500).json({ message: 'Failed to update poker desk', error });
      }
      break;

    case 'DELETE':
      try {
        if (!id) {
          return res.status(400).json({ message: 'ID is required for deleting' });
        }

        const deletedPokerDesk = await PokerDesk.findByIdAndDelete(id);
        if (!deletedPokerDesk) {
          return res.status(404).json({ message: 'Poker desk not found' });
        }
        res.status(204).end();
      } catch (error) {
        res.status(500).json({ message: 'Failed to delete poker desk', error });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
