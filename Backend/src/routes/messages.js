const express = require("express")
const { body, validationResult } = require("express-validator")
const Message = require("../models/Message")
const Room = require("../models/Room")
const auth = require("../middleware/auth")

const router = express.Router()

// Get messages for a room
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    const { roomId } = req.params
    const { page = 1, limit = 50 } = req.query

    // Check if user has access to room
    const room = await Room.findById(roomId)
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    const isMember = room.members.some((member) => member.user.toString() === req.user._id.toString())

    if (!isMember && room.isPrivate) {
      return res.status(403).json({ message: "Access denied" })
    }

    const messages = await Message.find({
      room: roomId,
      isDeleted: false,
    })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    res.json(messages.reverse())
  } catch (error) {
    console.error("Get messages error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Send message
router.post(
  "/",
  auth,
  [
    body("content").trim().isLength({ min: 1 }).withMessage("Message content required"),
    body("roomId").isMongoId().withMessage("Valid room ID required"),
    body("selfDestruct").optional().isInt({ min: 5, max: 300 }).withMessage("Self-destruct time must be 5-300 seconds"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { content, roomId, selfDestruct } = req.body

      // Check if user has access to room
      const room = await Room.findById(roomId)
      if (!room) {
        return res.status(404).json({ message: "Room not found" })
      }

      const isMember = room.members.some((member) => member.user.toString() === req.user._id.toString())

      if (!isMember) {
        return res.status(403).json({ message: "Access denied" })
      }

      const message = new Message({
        content,
        sender: req.user._id,
        room: roomId,
        selfDestruct,
      })

      await message.save()
      await message.populate("sender", "name email")

      // Update room activity
      await room.updateActivity()

      // Schedule self-destruct if applicable
      if (selfDestruct) {
        message.scheduleSelfDestruct()
      }

      res.status(201).json(message)
    } catch (error) {
      console.error("Send message error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Delete a message (soft delete)
router.delete("/:messageId", auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Only the sender can delete their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    message.isDeleted = true;
    message.content = "[Message deleted]";
    await message.save();

    // Emit socket event to room
    req.app.get("io").to(message.room.toString()).emit("message_deleted", {
      messageId: message._id,
    });

    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Mark message as viewed
router.post("/:messageId/view", auth, async (req, res) => {
  try {
    const { messageId } = req.params

    const message = await Message.findById(messageId)
    if (!message) {
      return res.status(404).json({ message: "Message not found" })
    }

    // Check if already viewed
    const alreadyViewed = message.viewedBy.some((view) => view.user.toString() === req.user._id.toString())

    if (!alreadyViewed) {
      message.viewedBy.push({
        user: req.user._id,
        viewedAt: new Date(),
      })

      await message.save()

      // Start self-destruct timer if applicable
      if (message.selfDestruct && !message.isDeleted) {
        message.scheduleSelfDestruct()
      }
    }

    res.json({ message: "Message viewed" })
  } catch (error) {
    console.error("View message error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
