import express from 'express';
import authenticate from '../middlewares/authMiddleware.js';
import {
  updateUserDetails,
  deleteRecentAddress,
  deleteSavedAddress, 
  updateSavedAddress,// ✅ import here
  addOrderToUser,
  // updateOrderDetails,
  // addOrder 
} from '../controllers/userController.js';


const router = express.Router(); // ✅ Declare before using

// GET current user
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// PUT /user/update — Update name, email, addresses
router.put('/update', authenticate, updateUserDetails);

// DELETE /user/recent-address/:id
router.delete('/recent-address/:id', authenticate, deleteRecentAddress);

// ✅ DELETE /user/saved-address/:id
router.delete('/saved-address/:id', authenticate, deleteSavedAddress);

// ✅ New route for updating a saved address
router.put('/saved-address/:id/update', authenticate, updateSavedAddress);


router.post('/:userId/orders', addOrderToUser);





export default router;


















// // PUT /user/order/:orderId
// router.put('/order/:orderId', updateOrderDetails);



// // ✅ NEW: Get a specific order by orderId (internal API use only)
// router.get('/order/:orderId', async (req, res) => {
//   const { orderId } = req.params;

//   // Internal API Key check
//   const internalApiKey = req.headers['x-internal-api-key'];
//   if (internalApiKey !== process.env.INTERNAL_API_KEY) {
//     return res.status(403).json({ error: 'Unauthorized' });
//   }

//   try {
//     const user = await User.findOne({ 'orders.orderId': orderId });
//     if (!user) return res.status(404).json({ error: 'Order not found' });

//     const order = user.orders.find(o => o.orderId === orderId);
//     res.json({ ...order.toObject(), userId: user._id }); // ✅ Include userId
//   } catch (err) {
//     console.error('Error fetching order:', err.message);
//     res.status(500).json({ error: 'Error fetching order' });
//   }
// });

// router.post('/order', authenticate, addOrder);