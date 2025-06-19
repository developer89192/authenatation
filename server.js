import app from './app.js'; // ES Module import for app
import mongoose from 'mongoose'; // ES Module import for mongoose
// import { MONGO_URI, PORT } from './config.js';

MONGO_URI = process.env.MONGO_URI;
export const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
  });
