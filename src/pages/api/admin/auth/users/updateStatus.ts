// pages/api/admin/users/[userId]/status.ts

import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../../config/dbConnect'; 
import User from '../../../../../models/user';
import { verifyToken } from '../../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    const payload :any =  verifyToken(token);
    if (!payload.userId || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
 
    const { status,userId } = req.body;

    const allowedStatuses = ['active', 'inactive', 'suspended'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User status updated', user });
  } catch (error : any) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
