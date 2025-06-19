import jwt from 'jsonwebtoken';
import User from '../models/User.js';
// import { JWT_SECRET } from '../config.js';
import dotenv from 'dotenv'; // Import dotenv to load .env variables
dotenv.config(); // Load the environment variables from the .env file

const JWT_SECRET = process.env.JWT_SECRET;

const authenticate = async (req, res, next) => {

  const token = req.cookies.access_token;
  if (!token) {
    // console.log('No access token found in cookies');
    return res.status(401).json({ message: 'Access Denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-refresh_token');
    if (!user) {
      console.log('User not found for decoded token id');
      return res.status(404).json({ message: 'User not found' });
    }
    req.user = user;
    return next();
  } catch (err) {
    console.log('JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or Expired Token' });
  }
};

export default authenticate;
