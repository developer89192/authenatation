import app from './app.js'; // ES Module import for app
import mongoose from 'mongoose'; // ES Module import for mongoose
import dotenv from 'dotenv'; // Import dotenv to load .env variables
dotenv.config(); // Load the environment variables from the .env file


// Declare MONGO_URI and PORT before using them
const MONGO_URI = process.env.MONGO_URI; // Use 'const' to declare the variables
const PORT = process.env.PORT || 5000;   // Default to 5000 if PORT is not set in the environment

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
