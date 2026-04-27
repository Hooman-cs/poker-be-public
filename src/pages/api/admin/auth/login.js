import dbConnect from '../../../../config/dbConnect';
import Admin from '../../../../models/admin';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'POST') {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      // Find the admin user by email and include the password field
      const admin = await Admin.findOne({ email });  

      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const pw=await bcrypt.hash(admin.password,10);
      console.log("admin is here",admin);
      console.log("admin id is here ",admin._id);
      console.log("admin is mobile here",pw);
      // Check if the admin's password exists before comparing
      // if (!admin.password) {
      //   return res.status(500).json({ error: 'User does not have a password set.' });
      // }

      // Compare the provided password with the stored hash
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Generate and save JWT token
      const token = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
      admin.token = token;
      admin.lastLogin = new Date();
      await admin.save();

      // Set token in cookie
      //res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Secure; SameSite=Strict; Max-Age=3600`);
      const isProduction = process.env.NODE_ENV === 'production';
      res.setHeader(
        'Set-Cookie',
        `token=${token}; HttpOnly; Path=/; ${isProduction ? 'Secure;' : ''} SameSite=Lax; Max-Age=3600`
      );

      return res.status(200).json({ message: 'Login successful' });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
