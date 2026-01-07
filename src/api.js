import axios from 'axios';
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = async (path, method = 'GET', data = {}) => {
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not logged in");

  const payload = {
    ...data,
    userEmail: user.email, 
    path: path
  };

  try {
    const config = {
      method: 'POST',
      url: API_URL,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify(payload),
    };

    const response = await axios(config);
    if (response.data.status === 'error') throw new Error(response.data.message);
    return response.data.data;

  } catch (error) {
    console.error("API Call Failed:", error);
    throw error;
  }
};

export default apiClient;