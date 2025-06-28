import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticate = async (req, res, next) => {
  // Look for token in Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Access Denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-refresh_token');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or Expired Token' });
  }
};

export default authenticate;