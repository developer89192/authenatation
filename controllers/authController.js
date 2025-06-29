import axios from 'axios';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { generateTokens } from '../utils/tokenUtils.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.API_KEY;
const MAX_VERIFICATION_ATTEMPTS = process.env.MAX_VERIFICATION_ATTEMPTS;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Helpers for refresh token array logic ---
const MAX_DEVICES = 3;

function addRefreshToken(user, token, device = null) {
  if (!user.refresh_tokens) user.refresh_tokens = [];
  // Add new one to front
  user.refresh_tokens.unshift({ token, createdAt: new Date(), device });
  // Keep only latest MAX_DEVICES
  user.refresh_tokens = user.refresh_tokens.slice(0, MAX_DEVICES);
}

function removeRefreshToken(user, token) {
  if (!user.refresh_tokens) return;
  user.refresh_tokens = user.refresh_tokens.filter(rt => rt.token !== token);
}

// SEND OTP
export const sendOtp = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    let user = await User.findOne({ mobile_number: mobileNumber });
    if (!user) {
      user = await User.create({ mobile_number: mobileNumber });
    }

    const otpKey = `otp:${mobileNumber}`;
    const attemptsKey = `otp_attempts:${mobileNumber}`;
    const OTP_EXPIRY = 300; // 5 minutes
    const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

    const existingOtp = await redisClient.get(otpKey);
    if (existingOtp) {
      return res.status(429).json({ error: 'OTP already sent. Please wait 5 minutes to resend.' });
    }

    const otp = generateOtp();
    await redisClient.setEx(otpKey, OTP_EXPIRY, otp);
    await redisClient.setEx(attemptsKey, OTP_EXPIRY, '0');

    const message = `Your OTP for Rythuri is ${otp}. It is valid for 5 minutes.`;

    try {
      await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        new URLSearchParams({
          message,
          language: 'english',
          route: 'q',
          numbers: mobileNumber,
        }),
        {
          headers: {
            authorization: FAST2SMS_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
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

      await redisClient.setEx(attemptsKey, 30, attempts.toString());
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

    // --- Multiple device support: add new token, keep at most 3 ---
    addRefreshToken(user, refreshToken, req.headers['user-agent'] || null);
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified successfully',
      userId: user._id,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('OTP verification failed:', error.message);
    next(error);
  }
};

// REFRESH TOKEN
export const refreshToken = async (req, res, next) => {
  try {
    // Expect refreshToken in body (not cookies)
    const { refreshToken: refresh_token } = req.body;
    if (!refresh_token) return res.sendStatus(401);

    const payload = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (
      !user ||
      !user.refresh_tokens ||
      !user.refresh_tokens.some(rt => rt.token === refresh_token)
    ) {
      return res.sendStatus(403);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

    // Remove old token, add new one
    removeRefreshToken(user, refresh_token);
    addRefreshToken(user, newRefreshToken, req.headers['user-agent'] || null);
    await user.save();

    res.json({
      message: 'Token refreshed',
      user: {
        id: user._id,
        mobile_number: user.mobile_number,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    next(err);
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  try {
    // Accept refreshToken in body or as Bearer header
    const refresh_token = req.body.refreshToken || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    // Remove only the matching token from array
    if (refresh_token) {
      await User.findOneAndUpdate(
        { 'refresh_tokens.token': refresh_token },
        { $pull: { refresh_tokens: { token: refresh_token } } },
        { new: true }
      );
    }

    // No cookies to clear; just send a message
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error("Logout error:", error);
    next(error);
  }
};