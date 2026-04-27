import dbConnect from '../../../../config/dbConnect';
import Poker from '../../../../models/poker';
import PokerDesk from '../../../../models/pokerDesk';
import PokerMode from '../../../../models/pokerMode';
export default async function handler(req, res) {
  const { method, query, body } = req;
  const { pokerModeId } = query;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
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

    case 'POST':
      try {
        const pokerMode = await PokerMode.findById(body.pokerModeId);
      
        if (!pokerMode) {
          return res.status(404).json({ message: 'PokerMode not found' });
        }
        const pokerGame = await Poker.findById(pokerMode.pokerId);
        if (!pokerGame) {
          return res.status(404).json({ message: 'PokerGame not found' });
        }
        const newPokerDeskData = {
          ...body,
          // Fields retrieved directly from PokerMode
          stake: pokerMode.stake,
          minBuyIn: pokerMode.minBuyIn,
          maxBuyIn: pokerMode.maxBuyIn,
          bType : pokerMode.bType,
          minPlayerCount: pokerMode.maxPlayerCount,
          blindsOrAntes: pokerMode.blindsOrAntes,
          status: pokerMode.status,
          gameType : pokerGame.gameType,
          mode : pokerMode.mode,
        };
        const newPokerDesk = await PokerDesk.create(newPokerDeskData);
        res.status(201).json(newPokerDesk);
      } catch (error) {
        res.status(500).json({ message: 'Failed to create poker desk', error });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
