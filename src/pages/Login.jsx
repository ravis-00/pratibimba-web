import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();

    // 🔐 HARDCODED DEV CREDENTIALS
    if (email === 'admin@test.com' && password === 'admin123') {
      // Create a fake user object
      const fakeUser = {
        email: email,
        displayName: "Admin User",
        uid: "dev-admin-123"
      };

      // Save to Local Storage (so you stay logged in if you refresh)
      localStorage.setItem('user', JSON.stringify(fakeUser));
      
      // Go to Dashboard
      window.location.href = "/"; 
    } else {
      alert("Invalid Credentials! Use admin@test.com / admin123");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-2">Pratibimba</h1>
        <p className="text-center text-gray-500 mb-8">Dev Mode Login</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded p-2"
              placeholder="admin@test.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded p-2"
              placeholder="admin123"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;