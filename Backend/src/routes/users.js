const express = require("express")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

// Get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("rooms")
    res.json(user)
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update user profile
router.put("/me", auth, async (req, res) => {
  try {
    const { name, avatar } = req.body

    const user = await User.findById(req.user._id)
    if (name) user.name = name
    if (avatar) user.avatar = avatar

    await user.save()
    res.json(user)
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get online users
router.get("/online", auth, async (req, res) => {
  try {
    const users = await User.find({ isOnline: true }).select("name email avatar lastSeen").limit(50)
    res.json(users)
  } catch (error) {
    console.error("Get online users error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
