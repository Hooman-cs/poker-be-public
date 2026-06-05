import admin from 'firebase-admin';
import { AuthError } from '@/lib/api/errors';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // .env.local stores the key with literal \n — convert to real newlines.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function verifyGoogleToken(
  idToken: string
): Promise<{ email: string; googleUserId: string; name?: string }> {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new AuthError(
      'INVALID_GOOGLE_TOKEN',
      'Firebase auth is not configured (missing env vars)'
    );
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new AuthError('INVALID_GOOGLE_TOKEN', 'Firebase ID token is invalid or expired');
  }

  if (!decoded.uid || !decoded.email) {
    throw new AuthError('INVALID_GOOGLE_TOKEN', 'Firebase token payload is missing required fields');
  }

  return {
    email: decoded.email,
    googleUserId: decoded.uid,
    name: decoded.name,
  };
}
