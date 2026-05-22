/**
 * @fileoverview Admin Login API Route (App Router)
 * Handles authentication, JWT generation, and secure cookie setting.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Admin from '@/models/admin';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('CRITICAL ERROR: JWT_SECRET is missing from .env.local');
    return NextResponse.json({ error: 'Internal Server Configuration Error' }, { status: 500 });
  }

  try {
    await dbConnect();

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // 1. Retrieve Admin Record (TypeScript now knows this is an IAdminDocument)
    const admin = await Admin.findOne({ email }).exec();
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // 2. Verify Cryptographic Password Match via the Model's Instance Method
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // 3. Generate Authentication Token
    const token = jwt.sign(
      { userId: admin._id, role: admin.role },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    // 4. Update Admin State
    // admin.token = token;
    // admin.lastLogin = new Date();
    // lastLogin still needs saving though, so change to:
    await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });
    // await admin.save();

    // 5. Assign Secure HTTP-Only Cookie
    const cookieStore = cookies();
    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Login API Error]:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
// /**
//  * @fileoverview Admin Login API Route (App Router)
//  * Handles authentication, JWT generation, and secure cookie setting.
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import Admin from '@/models/admin';
// import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs';
// import { cookies } from 'next/headers';

// // -----------------------------------------------------------------------------
// // Route Handler
// // -----------------------------------------------------------------------------

// export async function POST(request: NextRequest) {
//   // 1. Validate Environment Variables early
//   const JWT_SECRET = process.env.JWT_SECRET;
//   if (!JWT_SECRET) {
//     console.error('CRITICAL ERROR: JWT_SECRET is missing from .env.local');
//     return NextResponse.json({ error: 'Internal Server Configuration Error' }, { status: 500 });
//   }

//   try {
//     // 2. Establish Database Connection
//     await dbConnect();

//     // 3. Extract and Validate Body
//     const body = await request.json();
//     const { email, password } = body;

//     if (!email || !password) {
//       return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
//     }

//     // 4. Retrieve Admin Record
//     const admin = await Admin.findOne({ email }).exec();
//     if (!admin) {
//       return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
//     }

//     // 5. Verify Cryptographic Password Match
//     const isPasswordValid = await bcrypt.compare(password, admin.password);
//     if (!isPasswordValid) {
//       return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
//     }

//     // 6. Generate Authentication Token
//     const token = jwt.sign(
//       { userId: admin._id, role: admin.role },
//       JWT_SECRET,
//       { expiresIn: '1h' }
//     );

//     // 7. Update Admin State
//     admin.token = token;
//     admin.lastLogin = new Date();
//     await admin.save();

//     // 8. Assign Secure HTTP-Only Cookie via Next.js native API
//     const cookieStore = cookies();
//     const isProduction = process.env.NODE_ENV === 'production';

//     cookieStore.set({
//       name: 'token',
//       value: token,
//       httpOnly: true,         // Prevents client-side JS from reading the cookie (XSS protection)
//       secure: isProduction,   // Only sent over HTTPS in production
//       sameSite: 'lax',        // CSRF protection
//       path: '/',              // Available across the entire site
//       maxAge: 3600,           // 1 hour
//     });

//     // 9. Return Sanitized Payload to Client
//     return NextResponse.json({
//       message: 'Login successful',
//       user: {
//         id: admin._id,
//         email: admin.email,
//         role: admin.role,
//       }
//     }, { status: 200 });

//   } catch (error: any) {
//     console.error('[Login API Error]:', error.message);
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// }