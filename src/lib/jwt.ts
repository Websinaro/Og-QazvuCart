import jwt, { SignOptions } from 'jsonwebtoken';
import { env, config } from './env';

export interface UserTokenPayload {
  userId: number;
  username: string;
  email: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
}

const accessTokenOptions: SignOptions = { expiresIn: config.jwtExpiresIn };
const refreshTokenOptions: SignOptions = { expiresIn: config.jwtRefreshExpiresIn };

export function generateAccessToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, accessTokenOptions);
}

export function generateRefreshToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshTokenOptions);
}

export function verifyAccessToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}
