import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csrf from 'csurf'; 
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import dotenv from 'dotenv';
import pingRoute from './routes/pingRoute.js';

dotenv.config();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Routes - Fixed the routing issue
app.use('/auth', authRoutes);
app.use('/user', userRoutes); // ✅ Now route becomes /api/users/:userId/orders
app.use('/', pingRoute);

// Error handling middleware
app.use(errorHandler);

export default app;
