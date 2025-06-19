// authController.js

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { generateTokens } from '../utils/tokenUtils.js';
import User from '../models/User.js';
// import {
//   API_KEY,
//   OTP_EXPIRY,
//   MAX_VERIFICATION_ATTEMPTS,
//   JWT_SECRET,
//   JWT_REFRESH_SECRET,
// } from '../config.js';



const API_KEY = process.env.API_KEY;
const OTP_EXPIRY = process.env.OTP_EXPIRY;
const MAX_VERIFICATION_ATTEMPTS = process.env.MAX_VERIFICATION_ATTEMPTS;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;


// Redis Cloud Client Configuration
const redisClient = createClient({
  username: 'default',
  password: 'fA2YBZIANbdCkUtIBqaHw1hmBnu0ArYh',
  socket: {
    host: 'redis-16607.c212.ap-south-1-1.ec2.redns.redis-cloud.com',
    port: 16607,
  },
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error:', err));
await redisClient.connect();
console.log('✅ Connected to Redis Cloud');

// Generate a 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SEND OTP
export const sendOtp = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });

    let user = await User.findOne({ mobile_number: mobileNumber });
    if (!user) {
      user = await User.create({ mobile_number: mobileNumber });
    }

    const otpKey = `otp:${mobileNumber}`;
    const attemptsKey = `otp_attempts:${mobileNumber}`;

    const existingOtp = await redisClient.get(otpKey);
    if (existingOtp) {
      return res.status(429).json({ error: 'OTP already sent. Please wait 5 minutes to resend.' });
    }

    const otp = generateOtp();
    await redisClient.setEx(otpKey, OTP_EXPIRY || 300, otp);
    await redisClient.setEx(attemptsKey, OTP_EXPIRY || 300, '0');

    const message = `Your OTP is ${otp}. It is valid for 5 minutes.`;

    try {
      await axios.post(
        'http://localhost:5000/receive-otp',
        new URLSearchParams({
          message,
          language: 'english',
          route: 'q',
          numbers: mobileNumber,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // 'authorization': API_KEY,
          },
        }
      );

      res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
      await redisClient.del(otpKey);
      res.status(500).json({ error: 'Failed to send OTP', details: err.message });
    }
  } catch (error) {
    next(error);
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;

    if (!mobileNumber || !code) {
      return res.status(400).json({ error: 'Mobile number, verification ID and OTP code are required' });
    }

    const otpKey = `otp:${mobileNumber}`;
    const attemptsKey = `otp_attempts:${mobileNumber}`;

    const savedOtp = await redisClient.get(otpKey);
    if (!savedOtp) return res.status(400).json({ error: 'OTP expired or not found' });

    if (code !== savedOtp) {
      let attempts = parseInt(await redisClient.get(attemptsKey)) || 0;
      attempts++;

      if (attempts >= (MAX_VERIFICATION_ATTEMPTS || 3)) {
        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);
        return res.status(403).json({ error: 'Too many failed attempts. OTP has expired.' });
      }

      await redisClient.setEx(attemptsKey, OTP_EXPIRY || 300, attempts.toString());
      return res.status(400).json({ error: 'Incorrect OTP', attemptsLeft: (MAX_VERIFICATION_ATTEMPTS || 3) - attempts });
    }

    await redisClient.del(otpKey);
    await redisClient.del(attemptsKey);

    const user = await User.findOneAndUpdate(
      { mobile_number: mobileNumber },
      {
        is_verified: true,
        $push: { login_dates: new Date() },
      },
      { new: true }
    );

    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refresh_token = refreshToken;
    await user.save();

    res
      .cookie('access_token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      })
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true, message: 'OTP verified successfully', userId: user._id });
  } catch (error) {
    console.error('OTP verification failed:', error.message);
    next(error);
  }
};

// REFRESH TOKEN
export const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.cookies;
    if (!refresh_token) return res.sendStatus(401);

    const payload = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user || user.refresh_token !== refresh_token) {
      return res.sendStatus(403);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refresh_token = newRefreshToken;
    await user.save();

    res
    .cookie('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  })
     .cookie('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
      .json({ message: 'Token refreshed',

      user: {
      id: user._id,
      mobile_number: user.mobile_number,
      name: user.name,
      email: user.email,
    }
       });
  } catch (err) {
    next(err);
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.cookies;
    if (refresh_token) {
      await User.findOneAndUpdate(
        { refresh_token },
        { $unset: { refresh_token: '' } }
      );
    }

    res
      .clearCookie('access_token')
      .clearCookie('refresh_token')
      .json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};
