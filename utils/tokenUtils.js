import jwt from 'jsonwebtoken'; // ES Module import for jwt
// import { JWT_SECRET, JWT_REFRESH_SECRET } from '../config.js';
import dotenv from 'dotenv'; // Import dotenv to load .env variables
dotenv.config(); // Load the environment variables from the .env file


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};
