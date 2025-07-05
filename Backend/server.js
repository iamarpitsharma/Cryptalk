const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const authRoutes = require("./src/routes/auth")
const roomRoutes = require("./src/routes/rooms")
const messageRoutes = require("./src/routes/messages")
const userRoutes = require("./src/routes/users")
const socketHandler = require("./src/socket/socketHandler")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      "https://cryptalk-beryl.vercel.app",
      "http://localhost:5173"
    ].filter(Boolean),
    methods: ["GET", "POST"],
  },
})

// ✅ Trust reverse proxy like Render
app.set("trust proxy", 1);  // Fix for express-rate-limit + proxies

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://cryptalk-beryl.vercel.app",
      "http://localhost:5173"
    ].filter(Boolean),
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err))

// Routes
app.use("/auth", authRoutes)
app.use("/rooms", roomRoutes)
app.use("/messages", messageRoutes)
app.use("/users", userRoutes)
app.set("io", io);
// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Cryptalk Backend",
  })
})

// Socket.IO handling
socketHandler(io)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`🚀 Cryptalk Backend running on port ${PORT}`)
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`)
})

module.exports = { app, server, io }
