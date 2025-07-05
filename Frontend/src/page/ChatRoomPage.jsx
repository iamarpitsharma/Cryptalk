import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import {
  Send,
  ArrowLeft,
  Shield,
  Users,
  Settings,
  MoreVertical,
  Clock,
  Eye,
  Trash,
} from "lucide-react";
import axios from "../api/axios";
import { Button } from "../component/Button";
import { Input } from "../component/Input";
import { encryptMessage, decryptMessage } from "../lib/encryption";
const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || "https://cryptalk-backend.onrender.com";
// const SOCKET_SERVER_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

function SelfDestructMessage({ message, onDestruct }) {
  const [timeLeft, setTimeLeft] = useState(message.selfDestruct || 0);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (isRevealed && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isRevealed, timeLeft]);

  useEffect(() => {
    if (isRevealed && timeLeft === 0) {
      onDestruct(message._id);
    }
  }, [isRevealed, timeLeft, message._id, onDestruct]);

  const handleReveal = () => setIsRevealed(true);

  if (!isRevealed) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-4 cursor-pointer"
        onClick={handleReveal}
      >
        <div className="flex items-center space-x-2 text-red-400">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Self-Destruct Message</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Click to reveal (will auto-delete in {message.selfDestruct}s)
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: timeLeft <= 3 ? [1, 1.05, 1] : 1 }}
      transition={{ repeat: timeLeft <= 3 ? Infinity : 0, duration: 0.5 }}
      className={`bg-gradient-to-r from-red-500/20 to-orange-500/20 border rounded-lg p-4 ${timeLeft <= 3
          ? "border-red-400 shadow-lg shadow-red-500/25"
          : "border-red-500/30"
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-red-400">
          Self-Destruct Message
        </span>
        <div className="flex items-center space-x-1 text-red-400">
          <Clock className="w-3 h-3" />
          <span className="text-xs font-mono">{timeLeft}s</span>
        </div>
      </div>
      <p className="text-white">{decryptMessage(message.content)}</p>
    </motion.div>
  );
}

export default function ChatRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]); 
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [selfDestructTime, setSelfDestructTime] = useState(0);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomCreator, setRoomCreator] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("cryptalk_token");
    const userData = localStorage.getItem("cryptalk_user");

    if (!token || !userData) {
      navigate("/auth/login");
      return;
    }

    setUser(JSON.parse(userData));
    setLoading(false);

    // Fetch room details to get the real room name and members from backend
    axios
      .get(`/api/rooms/${roomId}`,
        { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setRoomName(res.data.name);
        setRoomMembers(res.data.members || []);
        setRoomCreator(res.data.creator?._id || res.data.creator);
      })
      .catch((err) => {
        console.error("Failed to fetch room info", err);
        setRoomName("Unknown Room");
      });

    // Initialize Socket.IO client with token auth
    socketRef.current = io(SOCKET_SERVER_URL, {
      auth: { token },
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected, emitting request_join_room", roomId);
      socketRef.current.emit("request_join_room", roomId);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket connect error:", err.message);
      if (err.message === "Authentication error") {
        navigate("/auth/login");
      }
    });

    // Remove previous listeners before adding new ones to prevent duplicates
    socketRef.current.off("joined_room");
    socketRef.current.off("new_message");
    socketRef.current.off("message_destroyed");

    // Listen for join_result (for the requester)
    socketRef.current.on("join_result", ({ accepted, message }) => {
      alert(message); // Show "Permission accepted/denied"
      if (accepted) {
        // Proceed to fetch messages, etc.
        axios.get(`/api/rooms/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => setMessages(res.data.messages))
          .catch((error) => console.error("Failed to fetch messages:", error));
      } else {
        // Optionally redirect or block UI
        navigate("/dashboard");
      }
    });

    // Listen for new incoming messages (only once)
    socketRef.current.off("new_message"); // Remove any previous listener
    socketRef.current.on("new_message", (message) => {
      console.log("[Socket] new_message received:", message);
      setMessages((prev) => {
        if (prev.some((msg) => msg._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    // Listen for message destruction to remove it from UI
    socketRef.current.on("message_destroyed", ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    });

    socketRef.current.on("message_deleted", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, isDeleted: true, content: "[Message deleted]" }
            : msg
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      const token = localStorage.getItem("cryptalk_token");
      if (!token) return;
      try {
        const res = await axios.get(`/api/rooms/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("Fetched messages from backend (mount):", res.data.messages);
        setMessages(res.data.messages);
      } catch (error) {
        console.error("Failed to fetch messages on mount:", error);
      }
    };
    fetchMessages();
  }, [roomId]);

  const sendMessage = () => {
    if (!newMessage.trim() || !user) return;

    const messagePayload = {
      roomId,
      content: encryptMessage(newMessage),
      selfDestruct: selfDestructTime > 0 ? selfDestructTime : null,
    };

    socketRef.current.emit("send_message", messagePayload);

    // Do NOT optimistically add message to UI; wait for server event
    setNewMessage("");
    setSelfDestructTime(0);
  };

  const handleDestructMessage = (messageId) => {
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit("leave_room", roomId);
      socketRef.current.disconnect();
    }
    navigate("/dashboard");
  };

  const handleDeleteMessage = async (messageId) => {
    const token = localStorage.getItem("cryptalk_token");
    await axios.delete(`/api/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // No need to update state here, socket event will handle it
  };

  // Add this after the main useEffect (after socketRef.current is set up)
  useEffect(() => {
    if (!socketRef.current) return;
    const handler = ({ roomId: reqRoomId, requesterId, requesterName }) => {
      // Only the creator can approve join requests
      const isCreator = user && roomCreator && user._id === roomCreator;
      if (isCreator && requesterId !== user._id) {
        if (window.confirm(`${requesterName} wants to join. Accept?`)) {
          socketRef.current.emit("join_response", { roomId: reqRoomId, requesterId, accepted: true });
        } else {
          socketRef.current.emit("join_response", { roomId: reqRoomId, requesterId, accepted: false });
        }
      }
    };
    socketRef.current.on("join_request", handler);
    return () => {
      socketRef.current.off("join_request", handler);
    };
  }, [roomMembers, user, roomCreator]);

  if (!user) return null;
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <span className="animate-pulse text-lg">Connecting to room...</span>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard">
              <motion.button
                whileHover={{ x: -5 }}
                className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center"
            >
              <Shield className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-white">{roomName}</h1>
              <p className="text-sm text-gray-400">End-to-end encrypted</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title="View Room Members (future)"
            >
              <Users className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Settings (future)"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title="More options (future)"
            >
              <MoreVertical className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-2 text-red-400 hover:text-red-600 transition-colors border border-red-400 rounded-lg ml-2"
              onClick={handleLeaveRoom}
            >
              Leave Room
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message._id || message.id || index}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex ${message.sender._id === user._id ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`max-w-xs lg:max-w-md ${message.sender._id === user._id ? "order-2" : "order-1"
                  }`}
              >
                {message.selfDestruct ? (
                  <SelfDestructMessage
                    message={message}
                    onDestruct={handleDestructMessage}
                  />
                ) : (
                  <div
                    className={`rounded-2xl p-4 ${message.sender._id === user._id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                        : "bg-gray-800/80 text-white border border-gray-700/50"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium opacity-75">
                        {message.sender?.name || "Unknown"}
                      </span>
                      {message.isEncrypted && <Shield className="w-3 h-3 opacity-75" />}
                    </div>
                    {message.sender._id === user._id && !message.isDeleted && (
                      <button onClick={() => handleDeleteMessage(message._id)}>
                        <Trash className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                    {message.isDeleted ? (
                      <span className="italic text-gray-400">[Message deleted]</span>
                    ) : (
                      <p className="text-sm">{decryptMessage(message.content)}</p>
                    )}
                    <p className="text-xs opacity-50 mt-1">
                      {new Date(message.createdAt || message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-4 bg-gray-800/50 backdrop-blur-xl border-t border-gray-700/50"
      >
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm text-gray-400">Self-destruct:</span>
          {[0, 5, 10, 30, 60].map((time) => (
            <motion.button
              key={time}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelfDestructTime(time)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${selfDestructTime === time
                  ? "bg-red-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
            >
              {time === 0 ? "Off" : `${time}s`}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your encrypted message..."
              className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400/20 pr-12"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white p-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
