const mongoose = require("mongoose")

const pendingRequestSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requesterName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
pendingRequestSchema.index({ roomId: 1, status: 1 })
pendingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model("PendingRequest", pendingRequestSchema) 