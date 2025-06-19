import express from 'express'; // ES Module import for express
import { sendOtp, verifyOtp, refreshToken, logout } from '../controllers/authController.js'; // ES Module imports for controller functions

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

export default router; // ES Module export default
