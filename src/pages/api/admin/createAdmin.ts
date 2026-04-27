// /pages/api/admin/create.ts
import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../config/dbConnect'; // Assuming you have a dbConnect utility
import Admin from '../../../models/admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { token } = req.headers;
  const { name, mobile, email, status, role } = req.body;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Connect to MongoDB
  await dbConnect();

  try {
    // Find an admin with the provided token and role 'superadmin'
    const requestingAdmin = await Admin.findOne({ token, role: 'superadmin' });

    // Check if the requesting admin has superadmin privileges
    if (!requestingAdmin) {
      return res.status(403).json({ message: 'Unauthorized: Only superadmins can create new admins' });
    }

    // Check for required fields for the new admin
    if (!name || !mobile) {
      return res.status(400).json({ message: 'Name and mobile are required' });
    }

    // Create the new admin
    const newAdmin = await Admin.create({
      name,
      mobile,
      email,
      status: status || 'active',
      role: role || 'editor',
      token: '', // Optionally generate a token for the new admin if needed
    });

    return res.status(201).json({ message: 'Admin created successfully', admin: newAdmin });
  } catch (error) {
    console.error('Error creating admin:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
