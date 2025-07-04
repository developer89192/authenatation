import mongoose from 'mongoose'; // ES Module import for mongoose

// --- Add refresh_tokens array to allow up to 3 devices ---
const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  device: { type: String }, // Optional: device info
}, { _id: false });

const userSchema = new mongoose.Schema({
  mobile_number: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },

  primary_address: {
    name: { type: String },
    apartment: { type: String },
    street: { type: String },
    instructions: { type: String },
    type: { type: String },
    lat: { type: Number },
    lon: { type: Number },
    address: { type: String }
  },

  saved_address: [
    {
      name: { type: String }, // address label
      apartment: { type: String },
      street: { type: String },
      instructions: { type: String },
      type: { type: String },
      lat: { type: Number },
      lon: { type: Number },
      address: { type: String },
      pincode: { type: String },
      receiver_name: { type: String }, // <-- for contact person at this address
      receiver_mobile: { type: String }, // <-- for contact phone number
    }
  ],

  selected_recent_address: {
    address: { type: String },
    apartment: { type: String, default: '' },
    street: { type: String, default: '' },
    name: { type: String, default: '' },
    lat: { type: Number },
    lon: { type: Number },
    type: { type: String },
    pincode: { type: String },
    receiver_name: { type: String },      // <-- added
    receiver_mobile: { type: String },    // <-- added
    _id: { type: mongoose.Schema.Types.ObjectId }, 
  },

  multiple_recent_addresses: [
    {
      address: { type: String },
      lat: { type: Number },
      lon: { type: Number },
      pincode: { type: String },
      type: { type: String },
    }
  ],

  orders: [
    {
      orderId: { type: String, required: true },
      orderStatus: { type: String, required: true },
      paymentStatus: { type: String, required: true },
      paymentMethod: { type: String },
      deliveryStatus: { type: String, required: true },
      returnStatus: { type: String, default: 'none' },
      items: [
        {
          _id: false,
          itemId: { type: String, required: true },
          itemName: { type: String, required: true },
          quantity: { type: Number, required: true },
          price: { type: Number, required: true }
        }
      ],
      totalPrice: { type: Number, required: true },
      orderDate: { type: Date, default: Date.now },
      address: {
        name: { type: String },
        apartment: { type: String },
        street: { type: String },
        type: { type: String },
        lat: { type: Number },
        lon: { type: Number },
        pincode: { type: String },
        address: { type: String }
      }
    }
  ],

  updated_at: [{ type: Date }],
  login_dates: [{ type: Date }],
  account_created_at: { type: Date, default: Date.now },
  is_verified: { type: Boolean, default: false },
  refresh_tokens: [refreshTokenSchema], // <-- Up to 3 refresh tokens here

  // Remove old: refresh_token: { type: String }, // Remove this line
});

// Add sparse+unique index at the schema level for orders.orderId
userSchema.index({ 'orders.orderId': 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema); // ES Module export default