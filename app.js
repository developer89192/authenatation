import express from 'express'; // ES Module import for express
import cookieParser from 'cookie-parser'; // ES Module import for cookie-parser
import cors from 'cors'; // ES Module import for cors
import csrf from 'csurf'; // ES Module import for csrf

import authRoutes from './routes/authRoutes.js'; // ES Module import for authRoutes
import userRoutes from './routes/userRoutes.js'; // ES Module import for userRoutes
import { errorHandler } from './middlewares/errorMiddleware.js'; // ES Module import for errorHandler

const app = express();
app.use(cors({
  origin: 'http://localhost:3001', // change to your frontend URL
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
console.log('Loaded INTERNAL_API_KEY:', process.env.INTERNAL_API_KEY);


// CSRF protection
// const csrfProtection = csrf({ cookie: true });
// app.use(csrfProtection);

// Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use(errorHandler);

export default app; // ES Module export default
