import dotenv from 'dotenv'; // Import dotenv for environment variable configuration
dotenv.config(); // Load environment variables from .env file

export const MONGO_URI = process.env.MONGO_URI;
export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
export const CPAAS_URL = 'https://cpaas.messagecentral.com/verification/v3';
export const CPAAS_CUSTOMER_ID = 'C-2B2277BB2CBB4FD';
export const CPAAS_AUTH_TOKEN = process.env.CPAAS_AUTH_TOKEN;
export const API_KEY = 65656567567
export const MAX_VERIFICATION_ATTEMPTS = 3
export const OTP_EXPIRY = 300
