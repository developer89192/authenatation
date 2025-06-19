import rateLimit from 'express-rate-limit'; // ES Module import for express-rate-limit

const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each phone to 3 OTP requests per windowMs
  message: 'Too many OTP requests, please try again later.',
  keyGenerator: (req) => req.body.mobileNumber || req.ip,
});

export default otpRateLimiter; // ES module export default
