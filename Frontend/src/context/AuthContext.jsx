import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "../api/axios";
import { io } from "socket.io-client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/users/me");
        setAuthUser(res.data);
      } catch {
        setAuthUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Setup socket connection when authUser is present
  useEffect(() => {
    if (authUser) {
      const newSocket = io(import.meta.env.VITE_API_URL,
        // || "http://localhost:5000",
        {
        auth: {
          token: localStorage.getItem("token"),
        },
      });
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [authUser]);

  // Login function
  const login = async (email, password) => {
    const res = await axios.post("/api/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setAuthUser(res.data.user);
  };

  // Logout function
  const logout = async () => {
    await axios.post("/api/auth/logout");
    localStorage.removeItem("token");
    setAuthUser(null);
    if (socket) socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ authUser, loading, socket, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for easy use
export const useAuth = () => useContext(AuthContext);
