const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { generateKeyPair } = require("../utils/encryption")

const router = express.Router()

// Register
router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, email, password } = req.body

      // Check if user exists
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" })
      }

      // Generate encryption key pair
      const { publicKey, privateKey } = generateKeyPair()

      // Create user
      const user = new User({
        name,
        email,
        password,
        publicKey,
        privateKey,
      })

      await user.save()

      // Generate JWT
      console.log("JWT_SECRET =", process.env.JWT_SECRET);

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "cryptalk_secret_key", { expiresIn: "1d" })

      res.status(201).json({
        message: "User created successfully",
        token,
        user: user.toJSON(),
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ message: "Server error during registration" })
    }
  },
)

// Login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      // Find user
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" })
      }

      // Check password
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" })
      }

      // Update online status
      user.isOnline = true
      user.lastSeen = new Date()
      await user.save()

      // Generate JWT
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "cryptalk_secret_key", { expiresIn: "1d" })

      res.json({
        message: "Login successful",
        token,
        user: user.toJSON(),
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ message: "Server error during login" })
    }
  },
)

// Logout
router.post("/logout", async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "cryptalk_secret_key")
      const user = await User.findById(decoded.userId)
      if (user) {
        user.isOnline = false
        user.lastSeen = new Date()
        await user.save()
      }
    }
    res.json({ message: "Logout successful" })
  } catch (error) {
    res.json({ message: "Logout successful" })
  }
})

module.exports = router
