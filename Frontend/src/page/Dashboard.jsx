import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Plus, Users, Lock, Settings, LogOut, Search, Hash } from "lucide-react"
import { Button } from "../component/Button"
import { Input } from "../component/Input"
import { Link } from "react-router-dom"
import axios from "../api/axios";

export default function Dashboard() {
    const [user, setUser] = useState(null)
    const [rooms, setRooms] = useState([])
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(true);
    const [showCreateRoom, setShowCreateRoom] = useState(false)
    const [newRoomName, setNewRoomName] = useState("")
    const navigate = useNavigate()

    useEffect(() => {
        const token = localStorage.getItem("cryptalk_token");
        const userData = localStorage.getItem("cryptalk_user");

        if (!token || !userData) {
            navigate("/auth/login");
            return;
        }

        setUser(JSON.parse(userData));

        const fetchRooms = async () => {
            try {
                setLoading(true);
                const res = await axios.get("/api/rooms", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                // setRooms(res.data.rooms || []);
                setRooms(res.data.rooms || res.data || []);
            } catch (error) {
                console.error("Failed to fetch rooms:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRooms();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("cryptalk_token")
        localStorage.removeItem("cryptalk_user")
        navigate("/")
    }

    //   const createRoom = () => {
    //     if (!newRoomName.trim()) return

    //     const newRoom = {
    //       id: Date.now().toString(),
    //       name: newRoomName,
    //       description: "New encrypted room",
    //       members: 1,
    //       isPrivate: true,
    //       lastActivity: "Just now",
    //     }

    //     setRooms([newRoom, ...rooms])
    //     setNewRoomName("")
    //     setShowCreateRoom(false)
    //   }

    // const createRoom = async () => {
    //     if (!newRoomName.trim()) return;

    //     const token = localStorage.getItem("cryptalk_token");

    //     try {
    //         const res = await axios.post(
    //             "/rooms/create",
    //             { name: newRoomName },
    //             {
    //                 headers: {
    //                     Authorization: `Bearer ${token}`,
    //                 },
    //             }
    //         );

    //         setRooms([res.data.room, ...rooms]); // backend should return created room
    //         setNewRoomName("");
    //         setShowCreateRoom(false);
    //     } catch (error) {
    //         console.error("Room creation failed:", error);
    //         alert("Failed to create room");
    //     }
    // };

    const createRoom = async () => {
        if (!newRoomName.trim()) return;

        const token = localStorage.getItem("cryptalk_token");

        try {
            const res = await axios.post(
                "/api/rooms",   // changed from '/rooms' to '/api/rooms'
                { name: newRoomName },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setRooms([res.data, ...rooms]); // your backend returns the new room object directly
            setNewRoomName("");
            setShowCreateRoom(false);
        } catch (error) {
            console.error("Room creation failed:", error);
            alert("Failed to create room");
        }
    };



    const filteredRooms = rooms.filter(
        (room) =>
            (room.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (room.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (room.creator?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )

    if (!user) return null
    if (loading) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center text-white">
            <span className="animate-pulse text-lg">Loading rooms...</span>
          </div>
        );
      }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
            {/* Background Blur */}
            <div className="fixed inset-0 opacity-10">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-bounce" />
            </div>

            {/* Header */}
            <motion.header
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-10 bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50"
            >
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                            className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center"
                        >
                            <Shield className="w-6 h-6 text-white" />
                        </motion.div>
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                Cryptalk
                            </h1>
                            <p className="text-sm text-gray-400">Welcome back, {user.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                        >
                            <Settings className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            {/* Main Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
                {/* Search + Create */}
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col sm:flex-row gap-4 mb-8"
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search rooms..."
                            className="pl-12 bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400/20"
                        />
                    </div>
                    <Button
                        onClick={() => setShowCreateRoom(true)}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 transition-all duration-300 transform hover:scale-105"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Room
                    </Button>
                </motion.div>

                {/* Modal */}
                <AnimatePresence>
                    {showCreateRoom && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                            onClick={() => setShowCreateRoom(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700"
                            >
                                <h3 className="text-xl font-bold text-white mb-4">Create New Room</h3>
                                <Input
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="Enter room name..."
                                    className="mb-4 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                                />
                                <div className="flex gap-3">
                                    <Button
                                        onClick={createRoom}
                                        className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                                    >
                                        Create
                                    </Button>
                                    <Button
                                        onClick={() => setShowCreateRoom(false)}
                                        variant="outline"
                                        className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Room Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {filteredRooms.map((room, index) => (
                        <motion.div
                            key={room._id}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                            whileHover={{ scale: 1.02, rotateY: 2 }}
                            className="group relative"
                        >
                            <Link to={`/chat/${room._id}`}>
                                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-cyan-400/50 transition-all duration-300 cursor-pointer h-full">
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-blue-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="relative">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center space-x-3">
                                                <motion.div
                                                    whileHover={{ rotate: 360 }}
                                                    transition={{ duration: 0.6 }}
                                                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${room.isPrivate
                                                        ? "bg-gradient-to-br from-purple-500 to-pink-600"
                                                        : "bg-gradient-to-br from-cyan-500 to-blue-600"
                                                        }`}
                                                >
                                                    {room.isPrivate ? (
                                                        <Lock className="w-6 h-6 text-white" />
                                                    ) : (
                                                        <Hash className="w-6 h-6 text-white" />
                                                    )}
                                                </motion.div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                                                        {room.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-400">{room.description}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-gray-400">
                                            <div className="flex items-center space-x-1">
                                                <Users className="w-4 h-4" />
                                                <span>{room.members?.length || 0} members</span>
                                            </div>
                                            <span>{room.lastActivity}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Empty State */}
                {filteredRooms.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                        <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-12 h-12 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">No rooms found</h3>
                        <p className="text-gray-500">Try adjusting your search or create a new room</p>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
