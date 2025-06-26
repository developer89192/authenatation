import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const validateLocation = (location) => {
  if (!location) return false;
  return (
    typeof location.lat === 'number' &&
    typeof location.lon === 'number' &&
    typeof location.address === 'string' &&
    (location.pincode === undefined || typeof location.pincode === 'string')
  );
};

export const addSavedAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const addressData = req.body;

    if (!addressData.name || !addressData.lat || !addressData.lon || !addressData.address) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Missing required fields: name, lat, lon, address'
      });
    }

    // Add address with new _id
    const newAddress = {
      name: addressData.name,
      apartment: addressData.apartment || '',
      street: addressData.street || '',
      instructions: addressData.instructions || '',
      type: addressData.type || 'home',
      lat: addressData.lat,
      lon: addressData.lon,
      address: addressData.address,
      pincode: addressData.pincode || '',
      receiver_name: addressData.receiver_name || '',
      receiver_mobile: addressData.receiver_mobile || '',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Create manually so we can get its _id
    const addressDoc = new mongoose.Types.ObjectId();
    newAddress._id = addressDoc;

    await User.updateOne(
      { _id: userId },
      { $push: { saved_address: { $each: [newAddress], $position: 0 } } },
      { session }
    );

    // Set as selected recent address WITH _id
    const selectedAddress = {
      _id: addressDoc,
      lat: newAddress.lat,
      lon: newAddress.lon,
      address: [newAddress.apartment, newAddress.street, newAddress.address]
        .filter(Boolean).join(', '),
      pincode: newAddress.pincode,
      type: newAddress.type,
      apartment: newAddress.apartment || '',
      street: newAddress.street || '',
      name: newAddress.name || '',
      receiver_name: newAddress.receiver_name || '',
      receiver_mobile: newAddress.receiver_mobile || '',
      updated_at: new Date()
    };

    await User.updateOne(
      { _id: userId },
      { $set: { selected_recent_address: selectedAddress } },
      { session }
    );

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('saved_address selected_recent_address');

    await session.commitTransaction();

    res.json({
      message: 'Address added successfully',
      new_address: updatedUser.saved_address[0],
      saved_address: updatedUser.saved_address,
      selected_recent_address: updatedUser.selected_recent_address
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding saved address:', error);
    res.status(500).json({
      message: 'Failed to add address',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

export const updateUserDetails = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const {
      name,
      email,
      primary_address,
      secondary_addresses,
      selected_recent_address,
      multiple_recent_addresses,
      saved_address
    } = req.body;

    if (multiple_recent_addresses && !validateLocation(multiple_recent_addresses)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid recent address data' });
    }

    if (saved_address && !validateLocation(saved_address)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid saved address data' });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (primary_address !== undefined) updateFields.primary_address = primary_address;
    if (secondary_addresses !== undefined) updateFields.secondary_addresses = secondary_addresses;

    // Handle multiple_recent_addresses (add new recent address)
    if (multiple_recent_addresses) {
      const newRecent = {
        lat: multiple_recent_addresses.lat,
        lon: multiple_recent_addresses.lon,
        address: multiple_recent_addresses.address,
        pincode: multiple_recent_addresses.pincode || null,
        type: 'recent',
        updated_at: new Date()
      };
      // Generate an _id for recent address
      newRecent._id = new mongoose.Types.ObjectId();

      // Remove duplicate if exists
      await User.updateOne(
        { _id: userId },
        { $pull: { multiple_recent_addresses: {
          lat: newRecent.lat,
          lon: newRecent.lon,
          address: newRecent.address
        }}},
        { session }
      );

      // Add to beginning of array
      await User.updateOne(
        { _id: userId },
        { $push: { multiple_recent_addresses: { $each: [newRecent], $position: 0 } } },
        { session }
      );

      // Set as selected recent address WITH _id
      updateFields.selected_recent_address = {
        ...newRecent
      };
    }

    // Handle saved addresses (add new saved address)
    if (saved_address) {
      const newSaved = {
        ...saved_address,
        type: saved_address.type,
        updated_at: new Date(),
        pincode: saved_address.pincode
      };
      // Generate an _id for saved address if not present
      newSaved._id = new mongoose.Types.ObjectId();

      // Remove duplicate if exists
      await User.updateOne(
        { _id: userId },
        { $pull: { saved_address: {
          lat: newSaved.lat,
          lon: newSaved.lon,
          address: newSaved.address
        }}},
        { session }
      );

      // Add to beginning of array
      await User.updateOne(
        { _id: userId },
        { $push: { saved_address: { $each: [newSaved], $position: 0 } } },
        { session }
      );

      // Set as selected recent address WITH _id
      updateFields.selected_recent_address = {
        ...newSaved
      };
    }

    if (Object.keys(updateFields).length > 0) {
      await User.updateOne(
        { _id: userId },
        { $set: updateFields },
        { session }
      );
    }

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('-password -__v');

    await session.commitTransaction();
    res.json(updatedUser);
  } catch (error) {
    await session.abortTransaction();
    console.error('Update failed:', error);

    if (error.name === 'ValidationError') {
      res.status(400).json({
        message: 'Validation failed',
        errors: error.errors
      });
    } else {
      res.status(500).json({
        message: 'Server error during update',
        error: error.message
      });
    }
  } finally {
    session.endSession();
  }
};

export const deleteRecentAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const addressId = req.params.id;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the address to be deleted
    const addressToDelete = user.multiple_recent_addresses.find(
      addr => addr._id.toString() === addressId
    );
    if (!addressToDelete) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Address not found' });
    }

    // Remove the address
    await User.updateOne(
      { _id: userId },
      { $pull: { multiple_recent_addresses: { _id: addressToDelete._id } } },
      { session }
    );

    // Is this the selected address (compare _id)?
    let isSelectedDeleted = false;
    const selected = user.selected_recent_address;
    if (selected && selected._id && selected._id.toString() === addressId) {
      isSelectedDeleted = true;
    }

    // After deletion, fetch fresh user doc for new address arrays
    const userAfter = await User.findById(userId).session(session);

    // Always prioritize saved_address[0], then multiple_recent_addresses[0], else unset
    if (isSelectedDeleted) {
      let nextSelected = null;
      if (userAfter.saved_address && userAfter.saved_address.length > 0) {
        nextSelected = { ...userAfter.saved_address[0]._doc };
      } else if (userAfter.multiple_recent_addresses && userAfter.multiple_recent_addresses.length > 0) {
        nextSelected = { ...userAfter.multiple_recent_addresses[0]._doc };
      }
      if (nextSelected) {
        await User.updateOne(
          { _id: userId },
          { $set: { selected_recent_address: nextSelected } },
          { session }
        );
      } else {
        await User.updateOne(
          { _id: userId },
          { $unset: { selected_recent_address: 1 } },
          { session }
        );
      }
    }

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('multiple_recent_addresses saved_address selected_recent_address');

    await session.commitTransaction();
    res.json({
      message: 'Address removed successfully',
      multiple_recent_addresses: updatedUser.multiple_recent_addresses,
      saved_address: updatedUser.saved_address,
      selected_recent_address: updatedUser.selected_recent_address
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing recent address:', error);
    res.status(500).json({
      message: 'Failed to remove address',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

export const deleteSavedAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const addressId = req.params.id;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the address to be deleted
    const addressToDelete = user.saved_address.find(
      addr => addr._id.toString() === addressId
    );
    if (!addressToDelete) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Address not found' });
    }

    // Remove the address
    await User.updateOne(
      { _id: userId },
      { $pull: { saved_address: { _id: addressToDelete._id } } },
      { session }
    );

    // Is this the selected address (compare _id)?
    let isSelectedDeleted = false;
    const selected = user.selected_recent_address;
    if (selected && selected._id && selected._id.toString() === addressId) {
      isSelectedDeleted = true;
    }

    // After deletion, fetch fresh user doc for new address arrays
    const userAfter = await User.findById(userId).session(session);

    // Always prioritize saved_address[0], then multiple_recent_addresses[0], else unset
    if (isSelectedDeleted) {
      let nextSelected = null;
      if (userAfter.saved_address && userAfter.saved_address.length > 0) {
        nextSelected = { ...userAfter.saved_address[0]._doc };
      } else if (userAfter.multiple_recent_addresses && userAfter.multiple_recent_addresses.length > 0) {
        nextSelected = { ...userAfter.multiple_recent_addresses[0]._doc };
      }
      if (nextSelected) {
        await User.updateOne(
          { _id: userId },
          { $set: { selected_recent_address: nextSelected } },
          { session }
        );
      } else {
        await User.updateOne(
          { _id: userId },
          { $unset: { selected_recent_address: 1 } },
          { session }
        );
      }
    }

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('saved_address multiple_recent_addresses selected_recent_address');

    await session.commitTransaction();
    res.json({
      message: 'Address removed successfully',
      saved_address: updatedUser.saved_address,
      multiple_recent_addresses: updatedUser.multiple_recent_addresses,
      selected_recent_address: updatedUser.selected_recent_address
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing saved address:', error);
    res.status(500).json({
      message: 'Failed to remove address',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

const validateSavedAddress = (data) => {
  return (
    data &&
    typeof data.name === 'string' &&
    typeof data.lat === 'number' &&
    typeof data.lon === 'number' &&
    typeof data.address === 'string'
  );
};

export const updateSavedAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const addressId = req.params.id;
    const data = req.body;

    if (!validateSavedAddress(data)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Missing required fields: name, lat, lon, address' });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.saved_address.findIndex(addr => addr._id.toString() === addressId);
    if (index === -1) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Saved address not found' });
    }

    // Update all fields, keep the same _id
    user.saved_address[index] = {
      ...user.saved_address[index]._doc,
      name: data.name,
      apartment: data.apartment || '',
      street: data.street || '',
      instructions: data.instructions || '',
      type: data.type || '',
      lat: data.lat,
      lon: data.lon,
      address: data.address,
      pincode: data.pincode || '',
      updated_at: new Date()
    };

    await user.save({ session });

    // If this was the selected_recent_address, update it too
    if (
      user.selected_recent_address &&
      user.selected_recent_address._id &&
      user.selected_recent_address._id.toString() === addressId
    ) {
      user.selected_recent_address = { ...user.saved_address[index]._doc };
      await User.updateOne(
        { _id: userId },
        { $set: { selected_recent_address: user.selected_recent_address } },
        { session }
      );
    }

    await session.commitTransaction();

    res.json({
      message: 'Saved address updated successfully',
      saved_address: user.saved_address,
      selected_recent_address: user.selected_recent_address
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Update failed:', err);
    res.status(500).json({ message: 'Update failed', error: err.message });
  } finally {
    session.endSession();
  }
};

// ...keep your order handlers unchanged...

export const updateOrderDetails = async (req, res) => {
  try {
    let userId;

    // Allow internal access via API key (bypass authMiddleware)
    const internalApiKey = req.headers['x-internal-api-key'];
    if (internalApiKey === process.env.INTERNAL_API_KEY) {
      const orderId = req.params.orderId;
      const user = await User.findOne({ 'orders.orderId': orderId });
      if (!user) return res.status(404).json({ message: 'User not found for this order' });
      userId = user._id;
    } else if (req.user?._id) {
      userId = req.user._id;
    } else {
      return res.status(400).json({ message: 'User ID missing' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const order = user.orders.find(o => o.orderId === req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    Object.assign(order, req.body); // update order fields
    await user.save();

    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error updating order:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};




export const addOrderToUser = async (req, res) => {
  const { userId } = req.params;
  const orderData = req.body.order;


  // Sanitize incoming order data
orderData.paymentMethod = orderData.paymentMethod || 'unknown';

// Optional: log it
console.log(`🧾 Payment Method: ${orderData.paymentMethod}`);



  // Log the full incoming request body
  // console.log(`🛬 Incoming order for user ${userId}:`, JSON.stringify(orderData, null, 2));

  // Security check
  const internalApiKey = req.headers['x-internal-api-key'];
  if (internalApiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`⚠️ No user found with ID: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Extra validation for items array
    if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
      console.warn(`⚠️ Order for user ${userId} has no valid items:`, orderData.items);
    } else {
      console.log(`✅ Order has ${orderData.items.length} item(s).`);
    }


user.orders.unshift(orderData); // ✅ Push order to the top
    await user.save();

    console.log(`✅ Order successfully added to user ${userId}`);
    res.status(200).json({ message: 'Order added successfully' });
  } catch (err) {
    console.error('❌ Failed to add order:', err.message);
    res.status(500).json({ error: 'Failed to add order' });
  }
};



export const checkActiveCodOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId, { orders: 1 });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const activeCodOrderExists = user.orders.some(order =>
      (String(order.paymentMethod).toLowerCase() === 'cod' ||
       String(order.paymentMode).toLowerCase() === 'cod') &&
      String(order.orderStatus).toLowerCase() === 'confirmed'
    );

    res.json({ hasActiveCodOrders: activeCodOrderExists });
  } catch (error) {
    console.error('Error checking active COD orders:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};