const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "file", "image", "system"],
      default: "text",
    },
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    selfDestruct: {
      type: Number,
      default: null,
    },
    viewedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Auto-delete self-destruct messages
messageSchema.methods.scheduleSelfDestruct = function () {
  if (this.selfDestruct) {
    setTimeout(async () => {
      try {
        await this.model("Message").findByIdAndUpdate(this._id, {
          isDeleted: true,
          deletedAt: new Date(),
          content: "[Message self-destructed]",
        })
      } catch (error) {
        console.error("Error self-destructing message:", error)
      }
    }, this.selfDestruct * 1000)
  }
}

module.exports = mongoose.model("Message", messageSchema)
