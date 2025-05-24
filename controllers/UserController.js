const userModel = require("../models/UserModel");
const encrypt = require("../utils/Encrypt");
const auth = require("../auth/AuthValidation");
require("dotenv").config();

// Create user
const createUser = async (req, res) => {
  try {
    const user = {
      FullName: req.body.FullName,
      Password: encrypt.generatePassword(req.body.Password), // Ensure this is async if needed
    };

    const savedUser = await userModel.create(user);

    if (savedUser) {
      res
        .status(201)
        .json({ message: "User created successfully", user: savedUser });
    } else {
      res.status(400).json({ message: "User creation failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

// Get all users
const getAllUser = async (req, res) => {
  try {
    const user = await userModel.find().lean(); // Use .lean() for faster query
    res.status(200).json({ data: user, message: "Users fetched successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user by ID
const getUserbyID = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await userModel.findById(id).lean();
    if (user) {
      res
        .status(200)
        .json({ message: "User fetched successfully", data: user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error });
  }
};

// Update user
const updateUser = async (req, res) => {
  const id = req.params.id;
  try {
    const userData = await userModel
      .findByIdAndUpdate(id, req.body, { new: true })
      .lean(); // Use .lean()
    res
      .status(200)
      .json({ data: userData, message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { userId,currentPassword, newPassword } = req.body;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await encrypt.comparePassword(
      currentPassword,
      user.Password
    );

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.Password = await encrypt.generatePassword(newPassword);
    user.passwordChangedAt = Date.now();
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error changing password", error: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  const id = req.params.id;
  try {
    const user = await userModel.findByIdAndDelete(id).lean(); // Use .lean()
    if (user) {
      res.status(200).json({ data: user, message: "Deleted successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// User login
const loginUser = async (req, res) => {
  const { FullName, Password } = req.body;
  let user;

  try {
    // Find user by FullName
    user = await userModel.findOne({ FullName }).lean();

    if (user) {
      const isPasswordValid = await encrypt.comparePassword(
        Password,
        user.Password
      );

      if (isPasswordValid) {
        auth.createSendToken(user, 200, res); // Send token if valid
      } else {
        res.status(400).json({ message: "Invalid password" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createUser,
  getAllUser,
  updateUser,
  getUserbyID,
  deleteUser,
  loginUser,
  changePassword,
};
