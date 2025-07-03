import axios from "../api/axios";

export const loginUser = async (email, password) => {
  const response = await axios.post("/api/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (name, email, password) => {
  const response = await axios.post("/api/auth/register", { name, email, password });
  return response.data;
};

export const logoutUser = async () => {
  const response = await axios.post("/api/auth/logout");
  return response.data;
};
