const express = require("express")
const { body, validationResult } = require("express-validator")
const Room = require("../models/Room")
const Message = require("../models/Message")
const auth = require("../middleware/auth")
const { generateRoomKey } = require("../utils/encryption")
const User = require("../models/User")

const router = express.Router()

// Get all rooms for user
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    const rooms = await Room.find({
      $or: [
        { "members.user": req.user._id },
        { isPrivate: false },
        { creator: req.user._id },
        { _id: { $in: user.roomHistory } }
      ],
    })
      .populate("creator", "name email")
      .populate("members.user", "name email isOnline")
      .sort({ lastActivity: -1 })

    res.json({rooms})
  } catch (error) {
    console.error("Get rooms error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Create room
router.post(
  "/",
  auth,
  [
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Room name required (1-100 characters)"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description too long"),
    body("isPrivate").optional().isBoolean(),
    body("password").optional().isLength({ min: 4 }).withMessage("Password must be at least 4 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, description, isPrivate, password } = req.body

      // Generate encryption key for room
      const encryptionKey = generateRoomKey()

      const room = new Room({
        name,
        description,
        isPrivate: isPrivate || false,
        password,
        creator: req.user._id,
        encryptionKey,
        members: [
          {
            user: req.user._id,
            role: "admin",
          },
        ],
      })

      await room.save()
      await room.populate("creator", "name email")
      await room.populate("members.user", "name email isOnline")

      res.status(201).json(room)
    } catch (error) {
      console.error("Create room error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Join room
router.post("/:roomId/join", auth, [body("password").optional().isString()], async (req, res) => {
  try {
    const { roomId } = req.params
    const { password } = req.body

    const room = await Room.findById(roomId)
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Check if already a member
    const isMember = room.members.some((member) => member.user.toString() === req.user._id.toString())
    if (isMember) {
      return res.status(400).json({ message: "Already a member of this room" })
    }

    // Check password for private rooms
    if (room.isPrivate && room.password && room.password !== password) {
      return res.status(400).json({ message: "Invalid room password" })
    }

    // Check room capacity
    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ message: "Room is full" })
    }

    // Add user to room
    room.members.push({
      user: req.user._id,
      role: "member",
    })

    // Add to user's roomHistory if not already present
    const user = await User.findById(req.user._id)
    if (!user.roomHistory.map(id => id.toString()).includes(roomId)) {
      user.roomHistory.push(roomId)
      await user.save()
    }

    await room.save()
    await room.populate("creator", "name email")
    await room.populate("members.user", "name email isOnline")

    res.json(room)
  } catch (error) {
    console.error("Join room error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// GET messages for a room

// router.get("/:roomId/messages", auth, async (req, res) => {
//   try {
//     const { roomId } = req.params;

//     // Make sure to query by 'room' field, not 'roomId'
//     const messages = await Message.find({ room: roomId, isDeleted: false })
//       .populate("sender", "name email")   // populate sender details
//       .sort({ createdAt: 1 });            // sort by creation time ascending

//     res.json({ messages });
//   } catch (error) {
//     console.error("Get messages error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
router.get("/:roomId/messages", auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId, isDeleted: false })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });
    console.log("Fetched messages for room", roomId, ":", messages); // <-- Add this
    res.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Leave room
router.post("/:roomId/leave", auth, async (req, res) => {
  try {
    const { roomId } = req.params

    const room = await Room.findById(roomId)
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Remove user from room
    room.members = room.members.filter((member) => member.user.toString() !== req.user._id.toString())

    await room.save()
    res.json({ message: "Left room successfully" })
  } catch (error) {
    console.error("Leave room error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get room details
router.get("/:roomId", auth, async (req, res) => {
  try {
    const { roomId } = req.params

    const room = await Room.findById(roomId)
      .populate("creator", "name email")
      .populate("members.user", "name email isOnline")

    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Check if user is a member or room is public
    const isMember = room.members.some((member) => member.user._id.toString() === req.user._id.toString())

    if (!isMember && room.isPrivate) {
      return res.status(403).json({ message: "Access denied" })
    }

    res.json(room)
  } catch (error) {
    console.error("Get room error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
