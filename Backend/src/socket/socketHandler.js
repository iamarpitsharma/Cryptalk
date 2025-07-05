const jwt = require("jsonwebtoken")
const User = require("../models/User")
const Room = require("../models/Room")
const Message = require("../models/Message")
const PendingRequest = require("../models/PendingRequest")

// In-memory store for socket IDs (for quick access)
const userSocketMap = new Map();

const socketHandler = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error("Authentication error"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "cryptalk_secret_key")
      const user = await User.findById(decoded.userId)

      if (!user) {
        return next(new Error("User not found"))
      }

      socket.userId = user._id.toString()
      socket.user = user
      userSocketMap.set(user._id.toString(), socket.id)
      next()
    } catch (error) {
      next(new Error("Authentication error"))
    }
  })

  io.on("connection", async (socket) => {
    console.log(`✅ User ${socket.user.name} connected`)

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date(),
    })

    // Join user to their rooms
    const userRooms = await Room.find({ "members.user": socket.userId })
    userRooms.forEach((room) => {
      socket.join(room._id.toString())
      socket.to(room._id.toString()).emit("user_online", {
        userId: socket.userId,
        userName: socket.user.name,
      })
    })

    // REMOVED: Pending request notification logic - no approval needed anymore

    // Handle joining a room (legacy - kept for compatibility)
    socket.on("join_room", async (roomId) => {
      try {
        console.log(`[Socket.IO] User ${socket.user.name} (${socket.userId}) joining room: ${roomId}`);
        const room = await Room.findById(roomId)
        if (!room) {
          socket.emit("error", { message: "Room not found" })
          return
        }

        // Check if user is already a member
        const isMember = room.members.some((member) => member.user.toString() === socket.userId)
        
        if (isMember) {
          // User is already a member, allow immediate join
          socket.join(roomId)
          socket.emit("joined_room", { roomId, roomName: room.name })
          
          // Notify other users in the room
          socket.to(roomId).emit("user_joined", {
            userId: socket.userId,
            userName: socket.user.name,
            roomId,
          })
          console.log(`[Socket.IO] User ${socket.user.name} joined room ${roomId} (existing member)`);
        } else {
          // User is not a member, request permission
          socket.emit("join_result", { accepted: false, message: "You need permission to join this room" })
        }
      } catch (error) {
        console.error("Join room error:", error)
        socket.emit("error", { message: "Failed to join room" })
      }
    })

    // Handle leaving a room
    socket.on("leave_room", (roomId) => {
      socket.leave(roomId)
      socket.to(roomId).emit("user_left", {
        userId: socket.userId,
        userName: socket.user.name,
        roomId,
      })
    })

    // Handle sending messages
    socket.on("send_message", async (data) => {
      try {
        const { roomId, content, selfDestruct } = data
        console.log(`[Socket.IO] User ${socket.user.name} (${socket.userId}) sending message to room: ${roomId}`);
        // Verify user has access to room
        const room = await Room.findById(roomId)
        if (!room) {
          socket.emit("error", { message: "Room not found" })
          return
        }

        const isMember = room.members.some((member) => member.user.toString() === socket.userId)

        if (!isMember) {
          socket.emit("error", { message: "Access denied" })
          return
        }

        // Create and save message
        const message = new Message({
          content,
          sender: socket.userId,
          room: roomId,
          selfDestruct,
        })

        await message.save()
        await message.populate("sender", "name email")

        // Update room activity
        await room.updateActivity()

        // Emit message to all users in the room
        io.to(roomId).emit("new_message", {
          _id: message._id,
          content: message.content,
          sender: {
            _id: message.sender._id,
            name: message.sender.name,
            email: message.sender.email,
          },
          timestamp: message.createdAt,
          isEncrypted: message.isEncrypted,
          selfDestruct: message.selfDestruct,
        })

        // Schedule self-destruct if applicable
        if (selfDestruct) {
          message.scheduleSelfDestruct()
        }
      } catch (error) {
        console.error("Send message error:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      socket.to(data.roomId).emit("user_typing", {
        userId: socket.userId,
        userName: socket.user.name,
        roomId: data.roomId,
      })
    })

    socket.on("typing_stop", (data) => {
      socket.to(data.roomId).emit("user_stop_typing", {
        userId: socket.userId,
        roomId: data.roomId,
      })
    })

    // Handle message viewing (for self-destruct)
    socket.on("view_message", async (messageId) => {
      try {
        const message = await Message.findById(messageId)
        if (!message) return

        // Check if already viewed
        const alreadyViewed = message.viewedBy.some((view) => view.user.toString() === socket.userId)

        if (!alreadyViewed) {
          message.viewedBy.push({
            user: socket.userId,
            viewedAt: new Date(),
          })

          await message.save()

          // Start self-destruct timer if applicable
          if (message.selfDestruct && !message.isDeleted) {
            setTimeout(async () => {
              try {
                await Message.findByIdAndUpdate(messageId, {
                  isDeleted: true,
                  deletedAt: new Date(),
                  content: "[Message self-destructed]",
                })

                // Notify all users in the room that message was destroyed
                io.to(message.room.toString()).emit("message_destroyed", {
                  messageId: messageId,
                })
              } catch (error) {
                console.error("Error self-destructing message:", error)
              }
            }, message.selfDestruct * 1000)
          }
        }
      } catch (error) {
        console.error("View message error:", error)
      }
    })

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`❌ User ${socket.user.name} disconnected`)

      // Remove from socket map
      userSocketMap.delete(socket.userId)

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      })

      // Notify all rooms that user went offline
      const userRooms = await Room.find({ "members.user": socket.userId })
      userRooms.forEach((room) => {
        socket.to(room._id.toString()).emit("user_offline", {
          userId: socket.userId,
          userName: socket.user.name,
        })
      })
    })

    // --- SIMPLIFIED JOIN ROOM (NO APPROVAL NEEDED) ---
    socket.on("request_join_room", async (roomId) => {
      try {
        console.log(`[Socket.IO] User ${socket.user.name} (${socket.userId}) joining room: ${roomId}`);
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit("join_result", { accepted: false, message: "Room not found" });
          return;
        }

        // Check if user is already a member
        const isMember = room.members.some((member) => member.user.toString() === socket.userId);
        const isCreator = room.creator.toString() === socket.userId;
        
        console.log(`[Socket.IO] Membership check for user ${socket.user.name}:`, {
          userId: socket.userId,
          roomId: roomId,
          isMember: isMember,
          isCreator: isCreator,
          roomMembers: room.members.map(m => ({ user: m.user.toString(), role: m.role })),
          roomCreator: room.creator.toString()
        });
        
        if (isMember || isCreator) {
          // User is already a member or creator, allow immediate join
          socket.join(roomId);
          socket.emit("join_result", { accepted: true, message: "Welcome back!" });
          console.log(`[Socket.IO] User ${socket.user.name} joined room ${roomId} (existing member/creator)`);
          return;
        }
        
        // If user is the creator but not in members list, add them automatically
        if (isCreator && !isMember) {
          console.log(`[Socket.IO] Creator ${socket.user.name} not in members list, adding automatically`);
          room.members.push({ user: socket.userId, role: "admin" });
          await room.save();
          socket.join(roomId);
          socket.emit("join_result", { accepted: true, message: "Welcome to your room!" });
          console.log(`[Socket.IO] User ${socket.user.name} added to room ${roomId} as creator`);
          return;
        }

        // NEW USER: Automatically add them to the room (no approval needed)
        console.log(`[Socket.IO] New user ${socket.user.name} automatically added to room ${roomId}`);
        room.members.push({ user: socket.userId, role: "member" });
        await room.save();
        
        socket.join(roomId);
        socket.emit("join_result", { accepted: true, message: "Welcome to the room!" });
        io.to(roomId).emit("user_joined", { userId: socket.userId, userName: socket.user.name, roomId });
        console.log(`[Socket.IO] User ${socket.user.name} joined room ${roomId} (new member)`);

      } catch (error) {
        console.error("Join room error:", error);
        socket.emit("join_result", { accepted: false, message: "Failed to join room" });
      }
    });
  })
}

module.exports = socketHandler
