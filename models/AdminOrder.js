// models/AdminOrder.js
import mongoose from 'mongoose';

// Sub-schema for individual items within an order (same as your User.orders.items structure)
const adminOrderItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
}, { _id: false }); // Prevents Mongoose from creating _id for subdocuments

// Sub-schema for customer details snapshot at the time of order
// (This needs to match what your createOrderCOD sends in 'customer')
const adminOrderCustomerSchema = new mongoose.Schema({
    id: { type: String }, // User's ID or 'guest_...'
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    pincode: { type: String },
}, { _id: false });

const adminOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // The unique order ID (e.g., COD_timestamp)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Reference to the User (optional, for guests)

    // Capture the full customer details sent from the order creation service
    customer: adminOrderCustomerSchema,

    // Capture the full cart items sent from the order creation service
    items: [adminOrderItemSchema], // Array of items in the order

    totalPrice: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },

    // Payment-related fields
    paymentSessionId: { type: String, default: null }, // For online payments
    paymentStatus: { type: String, required: true, enum: ['paid', 'not paid', 'failed', 'refunded'], default: 'not paid' },
    paymentMode: { type: String, required: true, enum: ['COD', 'Online'], default: 'COD' },
    paymentMethod: { type: String, required: true }, // e.g., 'cod', 'card', 'upi'

    // Order and Delivery Status fields
    orderStatus: { type: String, required: true, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    deliveryStatus: { type: String, required: true, enum: ['pending', 'out_for_delivery', 'delivered', 'failed_delivery'], default: 'pending' },
    returnStatus: { type: String, default: 'none', enum: ['none', 'requested', 'approved', 'rejected', 'completed'] },

    // The full delivery address string
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
,

}, { timestamps: true }); // Mongoose will automatically add createdAt and updatedAt

export default mongoose.model('AdminOrder', adminOrderSchema);