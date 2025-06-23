// routes.js
import express from 'express';
import authenticate from '../middlewares/authMiddleware.js';
import {
  updateUserDetails,
  deleteRecentAddress,
  deleteSavedAddress,
  updateSavedAddress,
  addSavedAddress,
  addOrderToUser,
  checkActiveCodOrders // <-- Add this import
} from '../controllers/userController.js';

const router = express.Router();

// GET current user
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// PUT /user/update — Update name, email, addresses
router.put('/update', authenticate, updateUserDetails);

// POST /user/saved-address — Add new saved address
router.post('/saved-address', authenticate, addSavedAddress);

// DELETE /user/recent-address/:id
router.delete('/recent-address/:id', authenticate, deleteRecentAddress);

// DELETE /user/saved-address/:id
router.delete('/saved-address/:id', authenticate, deleteSavedAddress);

// PUT /user/saved-address/:id — Update saved address
router.put('/saved-address/:id', authenticate, updateSavedAddress);

// POST /:userId/orders - Add order to user
router.post('/:userId/orders', addOrderToUser);

// GET /user/has-active-cod-orders - Check for active COD orders for the authenticated user
router.get('/has-active-cod-orders', authenticate, checkActiveCodOrders); // <-- New route

export default router;