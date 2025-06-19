import app from './app.js'; // ES Module import for app
import mongoose from 'mongoose'; // ES Module import for mongoose
import { MONGO_URI, PORT } from './config.js'; // ES Module import for config

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
