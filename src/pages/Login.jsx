import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { 
  ShieldCheck, Lock, Mail, Eye, EyeOff, 
  CalendarClock, ClipboardCheck, BarChart3, 
  ArrowRight, AlertCircle
} from 'lucide-react';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Direct DB Check
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (dbUser) {
        completeLogin(dbUser);
        return;
      }

      // 2. Auth Fallback
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error("Invalid credentials.");

      if (authData.user) {
         const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();
         const userData = profile || { email: email, role: 'User' };
         completeLogin(userData);
      }
    } catch (err) {
      console.error("Login Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (userData) => {
      localStorage.setItem('user', JSON.stringify(userData));
      if (onLogin) onLogin(userData);
      navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-gray-800">
      
      {/* ==========================================
          1. HEADER SECTION (Logo & Titles)
      ========================================== */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
            {!logoError ? (
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-20 w-auto object-contain"
                  onError={() => setLogoError(true)}
                />
            ) : (
                <div className="h-16 w-16 bg-orange-100 rounded-xl flex items-center justify-center border border-orange-200 shadow-sm">
                   <ShieldCheck size={36} className="text-orange-600" />
                </div>
            )}
        </div>
        
        <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
            Rashtrotthana Parishat
        </h2>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
            Pratibimba
        </h1>
        <p className="text-gray-500 font-medium">
            Internal Quality Audit Management System
        </p>
      </div>

      {/* ==========================================
          2. FEATURE CARDS (Moved Above Login)
      ========================================== */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-2">
        
        <FeatureCard 
            icon={<CalendarClock size={20}/>}
            title="Audit Planning"
            desc="Streamlined scheduling & compliance tracking."
        />
        
        <FeatureCard 
            icon={<ClipboardCheck size={20}/>}
            title="NC Closure Tracking"
            desc="Monitor non-conformances to resolution."
        />
        
        <FeatureCard 
            icon={<BarChart3 size={20}/>}
            title="Executive Insights"
            desc="Real-time visibility into quality health."
        />

      </div>

      {/* ==========================================
          3. LOGIN CARD
      ========================================== */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative z-10">
        <div className="p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
               <span className="p-1.5 bg-orange-50 rounded text-orange-600"><Lock size={16}/></span> 
               Secure Login
            </h3>

            <form onSubmit={handleLogin} className="space-y-5">
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm animate-shake">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Email</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-orange-600 transition-colors">
                            <Mail size={18} />
                        </div>
                        <input
                            type="email"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-500 outline-none transition text-sm font-medium"
                            placeholder="name@rashtrotthana.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-orange-600 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-500 outline-none transition text-sm font-medium"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                        <span className="text-gray-600 group-hover:text-gray-800">Remember me</span>
                    </label>
                    <a href="#" className="font-semibold text-orange-600 hover:text-orange-700 hover:underline">Forgot password?</a>
                </div>

                {/* Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? 'Authenticating...' : (
                    <>Sign In <ArrowRight size={18}/></>
                  )}
                </button>
            </form>
        </div>
        
        <div className="bg-gray-50 px-8 py-3 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5 uppercase tracking-wide font-semibold">
               <ShieldCheck size={12} /> Authorized Personnel Only
            </p>
        </div>
      </div>

      <div className="mt-12 text-center">
         <p className="text-xs text-gray-400">© 2025 Rashtrotthana Parishat • Internal Use Only</p>
      </div>

    </div>
  );
};

// Reusable Clean Card Component
const FeatureCard = ({ icon, title, desc }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow duration-300">
        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg flex-shrink-0">
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-gray-800 text-sm">{title}</h4>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default Login;