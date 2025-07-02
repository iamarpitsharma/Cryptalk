import axios from "../api/axios";

export const loginUser = async (email, password) => {
  const response = await axios.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (name, email, password) => {
  const response = await axios.post("/auth/register", { name, email, password });
  return response.data;
};

export const logoutUser = async () => {
  const response = await axios.post("/auth/logout");
  return response.data;
};
