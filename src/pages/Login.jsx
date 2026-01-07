import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // OPTIONAL: Call Backend to verify user exists in Sheet immediately
      // const profile = await apiClient('auth/me');
      // console.log("User Profile:", profile);

      navigate('/'); // Go to Dashboard after login
    } catch (error) {
      console.error("Login Failed", error);
      alert("Login Failed: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-700 mb-2">Pratibimba</h1>
        <p className="text-gray-500 mb-8">Internal Quality Audit System</p>
        
        <button 
          onClick={handleLogin}
          className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded flex items-center justify-center gap-3 hover:bg-gray-50 transition shadow-sm font-medium"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </button>

        <p className="mt-6 text-xs text-gray-400">
          Rashtrotthana Parishat &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;