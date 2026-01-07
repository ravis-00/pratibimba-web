import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = async (path, method = 'GET', data = {}) => {
  // GET USER FROM LOCAL STORAGE INSTEAD OF FIREBASE
  const storedUser = localStorage.getItem('user');
  
  if (!storedUser) throw new Error("User not logged in");
  
  const user = JSON.parse(storedUser);

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