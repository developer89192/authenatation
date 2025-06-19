import mongoose from 'mongoose'; // ES Module import for mongoose

const userSchema = new mongoose.Schema({
  mobile_number: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },

  primary_address: {
    name: { type: String},
    apartment: { type: String },
    street: { type: String },
    instructions: { type: String },
    type: {type: String},
    lat: { type: Number },
    lon: { type: Number },
    address: { type : String}
  },

  orders: [
  {
    orderId: { type: String, unique: true },
    // other order fields
  }
]
,


saved_address: [
  {
    name: { type: String, required: true },
    apartment: { type: String },
    street: { type: String },
    instructions: { type: String },
    type: { type: String },
    lat: { type: Number },
    lon: { type: Number },
    address: { type: String },
    pincode: { type: String } // ✅ Add this
  }
],

selected_recent_address: {
  address: { type: String },
  lat: { type: Number },
  lon: { type: Number },
  type: { type: String },
  pincode: { type: String } // ✅ Add this
}
,

  // Multiple recent addresses (same structure as the previous 'recent_addresses')
  multiple_recent_addresses: [
    {
      address: { type: String },
      lat: { type: Number },
      lon: { type: Number },
      pincode: { type: String },
    }
  ],

orders: [
  {
    orderId: { type: String, required: true, unique: true },
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
    orderDate: { type: Date, default: Date.now }
  }
]


,

  updated_at: [{ type: Date }],
  login_dates: [{ type: Date }],
  account_created_at: { type: Date, default: Date.now },
  is_verified: { type: Boolean, default: false },
  refresh_token: { type: String }, // Optional if you're storing it in DB
});

export default mongoose.model('User', userSchema); // ES Module export default
