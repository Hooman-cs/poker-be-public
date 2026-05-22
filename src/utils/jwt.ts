/**
 * @fileoverview Secure JWT generation and verification utility.
 */

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

// -----------------------------------------------------------------------------
// Strict Interfaces
// -----------------------------------------------------------------------------

/**
 * Defines the strict shape of our JWT Payload.
 * Extend this if you need to pass additional data (e.g., role, sessionId).
 */
export interface IJwtPayload extends JwtPayload {
  userId: string;
  role?: 'user' | 'editor' | 'admin' | 'viewer'; // Inherited from your User model
}

// -----------------------------------------------------------------------------
// Engine Logic
// -----------------------------------------------------------------------------

/**
 * Signs a payload and returns a JWT.
 * @param payload - The strictly typed user data to encode.
 * @param options - Optional JWT signing options (defaults to 1h expiration).
 * @returns The signed JWT string.
 */
export const signToken = (
  payload: IJwtPayload, 
  // options: SignOptions = { expiresIn: '1h' }
  options: SignOptions = { expiresIn: '7d' }
): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('[FATAL ERROR]: JWT_SECRET is not defined in the environment variables.');
  }

  return jwt.sign(payload, secret, options);
};

/**
 * Verifies a JWT and extracts the strongly-typed payload.
 * @param token - The JWT string extracted from the request header/cookie.
 * @returns The decoded payload, or null if the token is invalid/expired.
 */
export const verifyToken = (token: string): IJwtPayload | null => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('[FATAL ERROR]: JWT_SECRET is not defined in the environment variables.');
  }

  try {
    // We assert the type here because we tightly control the issuance in signToken
    return jwt.verify(token, secret) as IJwtPayload;
  } catch (error) {
    // Log the error internally for debugging, but return null to the caller
    console.error('[JWT Verification Error]:', error instanceof Error ? error.message : 'Invalid token');
    return null;
  }
};