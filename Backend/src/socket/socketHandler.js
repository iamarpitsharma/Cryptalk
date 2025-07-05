const jwt = require("jsonwebtoken")
const User = require("../models/User")
const Room = require("../models/Room")
const Message = require("../models/Message")

// In-memory store for pending join requests (for demo; use DB for production)
const pendingJoinRequests = {};

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

    // --- JOIN BY PERMISSION FEATURE ---
    socket.on("request_join_room", async (roomId) => {
      try {
        console.log(`[Socket.IO] User ${socket.user.name} (${socket.userId}) requesting to join room: ${roomId}`);
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit("join_result", { accepted: false, message: "Room not found" });
          return;
        }

        // Check if user is already a member
        const isMember = room.members.some((member) => member.user.toString() === socket.userId);
        if (isMember) {
          // User is already a member, allow immediate join
          socket.join(roomId);
          socket.emit("join_result", { accepted: true, message: "Welcome back!" });
          console.log(`[Socket.IO] User ${socket.user.name} joined room ${roomId} (existing member)`);
          return;
        }

        // Check if there's already a pending request
        if (pendingJoinRequests[roomId] && pendingJoinRequests[roomId][socket.userId]) {
          socket.emit("join_result", { accepted: false, message: "Request already pending" });
          return;
        }

        // Notify all current members except the requester
        io.to(roomId).emit("join_request", {
          roomId,
          requesterId: socket.userId,
          requesterName: socket.user.name,
        });
        
        // Store pending request
        pendingJoinRequests[roomId] = pendingJoinRequests[roomId] || {};
        pendingJoinRequests[roomId][socket.userId] = socket.id;
        
        console.log(`[Socket.IO] Join request sent for user ${socket.user.name} to room ${roomId}`);
      } catch (error) {
        console.error("Request join room error:", error);
        socket.emit("join_result", { accepted: false, message: "Failed to request join" });
      }
    });

    socket.on("join_response", async ({ roomId, requesterId, accepted }) => {
      try {
        console.log(`[Socket.IO] Join response from ${socket.user.name} for user ${requesterId}: ${accepted ? 'accepted' : 'denied'}`);
        
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        // Only allow the creator to approve/deny
        if (room.creator.toString() !== socket.userId) {
          socket.emit("error", { message: "Only room creator can approve requests" });
          return;
        }

        if (!pendingJoinRequests[roomId] || !pendingJoinRequests[roomId][requesterId]) {
          socket.emit("error", { message: "No pending request found" });
          return;
        }

        const requesterSocketId = pendingJoinRequests[roomId][requesterId];
        const requesterSocket = io.sockets.sockets.get(requesterSocketId);

        if (accepted) {
          // Add user to room in DB
          if (!room.members.some(m => m.user.toString() === requesterId)) {
            room.members.push({ user: requesterId, role: "member" });
            await room.save();
            console.log(`[Socket.IO] User ${requesterId} added to room ${roomId} in database`);
          }
          
          // Let the user join the socket room
          if (requesterSocket) {
            requesterSocket.join(roomId);
            requesterSocket.emit("join_result", { accepted: true, message: "Permission accepted! Welcome to the room." });
            io.to(roomId).emit("user_joined", { userId: requesterId, userName: requesterSocket.user.name, roomId });
            console.log(`[Socket.IO] User ${requesterSocket.user.name} joined room ${roomId} after approval`);
          }
        } else {
          if (requesterSocket) {
            requesterSocket.emit("join_result", { accepted: false, message: "Permission denied by room admin" });
            console.log(`[Socket.IO] User ${requesterSocket.user.name} denied access to room ${roomId}`);
          }
        }
        
        // Remove pending request
        delete pendingJoinRequests[roomId][requesterId];
        console.log(`[Socket.IO] Pending request removed for user ${requesterId} in room ${roomId}`);
      } catch (error) {
        console.error("Join response error:", error);
        socket.emit("error", { message: "Failed to process join response" });
      }
    });
  })
}

module.exports = socketHandler
