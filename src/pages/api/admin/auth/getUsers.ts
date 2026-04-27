// pages/api/admin/users.ts
import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../config/dbConnect'; 
import User from '../../../../models/user';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    const payload : any = await verifyToken(token);
    if (!payload.userId || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const { page = 1, limit = 10, status, startDate, endDate, minGamesPlayed } = req.query;

    // Set default startDate as '1/1/2000' and default endDate as today
    const defaultStartDate = new Date('2000-01-01');
    const defaultEndDate = new Date();

    // Convert to Date objects if not provided, otherwise use the provided values
    const finalStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
    const finalEndDate = endDate ? new Date(endDate as string) : defaultEndDate;

    const filters: any = {};
    if (status) filters.status = status;
    filters.registrationDate = { $gte: finalStartDate, $lte: finalEndDate };
    if (minGamesPlayed) filters.gamesPlayed = { $gte: Number(minGamesPlayed) };

    const users = await User.find(filters)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ registrationDate: -1 }) // Sort by registration date descending
      .select('-password'); // Exclude password

    const totalUsers = await User.countDocuments(filters);

    return res.status(200).json({
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error:any) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
