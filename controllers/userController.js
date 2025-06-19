import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv'; // Import dotenv to load .env variables
dotenv.config(); // Load the environment variables from the .env fi

const validateLocation = (location) => {
  if (!location) return false;
  return (
    typeof location.lat === 'number' &&
    typeof location.lon === 'number' &&
    typeof location.address === 'string' &&
    (location.pincode === undefined || typeof location.pincode === 'string')
  );
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

    // Validate inputs
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

    // Handle recent addresses
    if (multiple_recent_addresses) {
    const recent = {
  lat: multiple_recent_addresses.lat,
  lon: multiple_recent_addresses.lon,
  address: multiple_recent_addresses.address,
  pincode: multiple_recent_addresses.pincode || null, // <-- Add this
  type: 'recent',
  updated_at: new Date()
};


      // Remove duplicate if exists
      await User.updateOne(
        { _id: userId },
        { $pull: { multiple_recent_addresses: { 
          lat: recent.lat,
          lon: recent.lon,
          address: recent.address
        }}},
        { session }
      );

      // Add to beginning of array
      await User.updateOne(
        { _id: userId },
        { $push: { multiple_recent_addresses: { $each: [recent], $position: 0 } } },
        { session }
      );

      updateFields.selected_recent_address = recent;
    }

    // Handle saved addresses
    if (saved_address) {
      const saved = {
        ...saved_address,
        type: saved_address.type,
        updated_at: new Date(),
        pincode: saved_address.pincode
      };

      // Remove duplicate if exists
      await User.updateOne(
        { _id: userId },
        { $pull: { saved_address: { 
          lat: saved.lat,
          lon: saved.lon,
          address: saved.address
        }}},
        { session }
      );

      // Add to beginning of array
      await User.updateOne(
        { _id: userId },
        { $push: { saved_address: { $each: [saved], $position: 0 } } },
        { session }
      );

updateFields.selected_recent_address = {
  lat: saved.lat,
  lon: saved.lon,
  address: [saved.apartment, saved.street, saved.address].filter(Boolean).join(', '),
  pincode: saved.pincode || '',
  type: saved.type,
};

    }

    // Update other fields
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

    // Update selected address if needed
    let selectedAddress = user.selected_recent_address;
    if (selectedAddress && selectedAddress._id?.toString() === addressId) {
      const [newSelected] = user.multiple_recent_addresses
        .filter(addr => addr._id.toString() !== addressId)
        .slice(0, 1);

      if (newSelected) {
        await User.updateOne(
          { _id: userId },
          { $set: { selected_recent_address: newSelected } },
          { session }
        );
        selectedAddress = newSelected;
      } else {
        await User.updateOne(
          { _id: userId },
          { $unset: { selected_recent_address: 1 } },
          { session }
        );
        selectedAddress = null;
      }
    }

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('multiple_recent_addresses selected_recent_address');

    await session.commitTransaction();
    res.json({
      message: 'Address removed successfully',
      multiple_recent_addresses: updatedUser.multiple_recent_addresses,
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

    // Update selected address if needed
    let selectedAddress = user.selected_recent_address;
    if (selectedAddress && selectedAddress._id?.toString() === addressId) {
      const [newSelected] = user.saved_address
        .filter(addr => addr._id.toString() !== addressId)
        .slice(0, 1);

      if (newSelected) {
        await User.updateOne(
          { _id: userId },
          { $set: { selected_recent_address: newSelected } },
          { session }
        );
        selectedAddress = newSelected;
      } else if (user.multiple_recent_addresses.length > 0) {
        const [recentSelected] = user.multiple_recent_addresses.slice(0, 1);
        await User.updateOne(
          { _id: userId },
          { $set: { selected_recent_address: recentSelected } },
          { session }
        );
        selectedAddress = recentSelected;
      } else {
        await User.updateOne(
          { _id: userId },
          { $unset: { selected_recent_address: 1 } },
          { session }
        );
        selectedAddress = null;
      }
    }

    const updatedUser = await User.findById(userId)
      .session(session)
      .select('saved_address selected_recent_address');

    await session.commitTransaction();
    res.json({
      message: 'Address removed successfully',
      saved_address: updatedUser.saved_address,
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

    // Update all fields
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

    // If this was the selected_recent_address, update that too
    if (
      user.selected_recent_address &&
      user.selected_recent_address._id?.toString() === addressId
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


