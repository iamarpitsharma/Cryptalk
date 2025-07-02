import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import React from 'react'
import { Toaster } from "react-hot-toast";
import LandingPage from "../page/LandingPage";
import Login from "../page/Login"
import Signup from "../page/Signup"
import ChatRoomPage from "../page/ChatRoomPage";
import Dashboard from "../page/Dashboard"
function AppRoutes() {
    return (
    <>
        <Toaster position="top-right" />
        <Routes>
                <Route path='/' element={<LandingPage />} />
                <Route path='/auth/login' element={<Login />} />
                <Route path="/auth/register" element={<Signup />} />
                <Route path="/chat/:roomId" element={<ChatRoomPage />} />
                <Route path="/dashboard" element={<Dashboard/>} />

        </Routes>
    </>
    )
}

export default AppRoutes