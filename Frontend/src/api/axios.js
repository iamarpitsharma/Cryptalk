// import axios from "axios";

// const axiosInstance = axios.create({
//     baseURL: "http://localhost:5000/api", // backend base URL + /api
//     //  import.meta.env.VITE_API_URL || 
//     withCredentials: true, // to send cookies or credentials if you use them
//     headers: {
//         "Content-Type": "application/json",
//     },
// });

// // Automatically attach JWT token from localStorage on each request
// axiosInstance.interceptors.request.use(
//     (config) => {
//         const token = localStorage.getItem("cryptalk_token");
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => Promise.reject(error)
// );

// export default axiosInstance;

import axios from "axios";

const instance = axios.create({
  baseURL: "https://cryptalk-backend.onrender.com/api",
  withCredentials: true,
});

export default instance;
