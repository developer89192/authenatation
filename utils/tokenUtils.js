import jwt from 'jsonwebtoken'; // ES Module import for jwt
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../config.js'; // ES Module import for config

export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};
