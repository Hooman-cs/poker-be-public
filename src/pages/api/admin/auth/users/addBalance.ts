// pages/api/admin/users/[userId]/balance.ts

import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../../config/dbConnect';
import User from '../../../../../models/user';
import { verifyToken } from '../../../../../utils/jwt';
import cookie from 'cookie';
import { IWalletTransaction, IAmountBreakdown } from '@/utils/pokerModelTypes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    const payload: any = verifyToken(token);

    if (!payload.userId || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const { userId, bonusAmount, remark, action } = req.body;

    // Input validation
    if (!bonusAmount || bonusAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount. Must be a positive number.' });
    }

    if (!remark || typeof remark !== 'string' || remark.trim().length === 0) {
      return res.status(400).json({ message: 'Remark is required and must be a non-empty string.' });
    }

    if (action !== 'add' && action !== 'remove') {
      return res.status(400).json({ message: 'Invalid action. Must be "add" or "remove".' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create the amount breakdown
    const amountBreakdown: IAmountBreakdown = {
      cashAmount: 0, // Adjust if there's a cash portion
      instantBonus: 0, // Adjust if there's an instant bonus portion
      lockedBonus: bonusAmount, // Focus on lockedBonus for this action
      gst: 0, // Adjust if there's GST
      tds: 0, // Adjust if there's TDS deductions
      otherDeductions: 0, // Adjust for other deductions if needed
      total: bonusAmount, // The total is equal to the bonus amount for now
    };

    // Adjust lockedBonus based on action
    if (action === 'add') {
      user.wallet.lockedBonus += bonusAmount;
    } else if (action === 'remove') {
      if (user.wallet.lockedBonus < bonusAmount) {
        return res.status(400).json({ message: 'Insufficient locked bonus to remove the specified amount.' });
      }
      user.wallet.lockedBonus -= bonusAmount;
    }

    // Create a wallet transaction
    const walletTransaction: IWalletTransaction = {
      status: 'completed',
      amount: amountBreakdown,
      type: 'bonus',
      remark,
      createdOn: new Date(),
      completedOn: new Date(),
    };

    user.wallet.transactions.push(walletTransaction);
    await user.save();

    return res.status(200).json({ message: `Amount ${action}ed successfully`, user });
  } catch (error: any) {
    console.error('Error updating user balance:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
