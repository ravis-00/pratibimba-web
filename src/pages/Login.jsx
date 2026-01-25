import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { 
  ShieldCheck, Lock, Mail, Eye, EyeOff, 
  CalendarClock, ClipboardCheck, BarChart3, 
  ArrowRight, AlertCircle, CheckCircle2 
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
  
  // 🟢 LOGO STATE
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

      if (authError) throw new Error("Invalid credentials. Please check your email and password.");

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
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-800 bg-slate-50">
      
      {/* ==========================================
          LEFT SECTION: BRANDING & CONTEXT (Orange Hero)
      ========================================== */}
      <div className="md:w-1/2 lg:w-5/12 bg-gradient-to-br from-orange-700 via-orange-600 to-red-700 text-white flex flex-col justify-center px-12 py-16 relative overflow-hidden">
        
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-orange-800 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-800 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10">
          
          {/* 🟢 1. LOGO SECTION */}
          <div className="flex items-center gap-4 mb-8">
             {!logoError ? (
                // OPTION A: Show Image (logo.png)
                <img 
                  src="/logo.png" 
                  alt="Organization Logo" 
                  className="h-20 w-auto object-contain bg-white/90 rounded-lg p-2 shadow-lg"
                  onError={() => {
                      console.warn("Logo image failed to load. Switching to Shield Icon.");
                      setLogoError(true);
                  }} 
                />
             ) : (
                // OPTION B: Fallback Icon (If image is missing)
                <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-inner">
                   <ShieldCheck size={36} className="text-white" />
                </div>
             )}
             
             <div>
                <p className="text-xs font-bold tracking-widest text-orange-200 uppercase mb-1">Rashtrotthana Parishat</p>
                <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Pratibimba</h1>
             </div>
          </div>

          <h2 className="text-4xl font-extrabold mb-6 leading-tight text-white">
            Internal Quality <br/>
            <span className="text-orange-200">Audit Management System</span>
          </h2>
          
          <p className="text-orange-100 mb-10 text-lg leading-relaxed max-w-md font-medium">
            Secure, centralized governance for planning, tracking, and closing internal audits across all institutions.
          </p>

          {/* Feature Cards */}
          <div className="space-y-4">
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
        </div>

        <div className="mt-auto pt-10 relative z-10">
           <p className="text-xs text-orange-200/80">© 2025 Rashtrotthana Parishat • Internal Use Only</p>
        </div>
      </div>

      {/* ==========================================
          RIGHT SECTION: SECURE LOGIN FORM
      ========================================== */}
      <div className="md:w-1/2 lg:w-7/12 flex flex-col justify-center items-center p-8 bg-slate-50">
        
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            
            {/* Header */}
            <div className="px-8 pt-8 pb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                <p className="text-slate-500 text-sm">Please sign in to your account.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="px-8 pb-8 space-y-5">
                
                {/* Error Alert */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm animate-shake">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email Field */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-600 transition-colors">
                            <Mail size={18} />
                        </div>
                        <input
                            type="email"
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-600 outline-none transition text-sm text-slate-800 font-medium placeholder:text-slate-300"
                            placeholder="name@rashtrotthana.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                {/* Password Field */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-600 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full pl-10 pr-10 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-600 outline-none transition text-sm text-slate-800 font-medium placeholder:text-slate-300"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 border rounded transition-colors flex items-center justify-center ${rememberMe ? 'bg-orange-600 border-orange-600' : 'border-slate-300 bg-white group-hover:border-orange-400'}`}>
                            {rememberMe && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                        <span className="text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
                    </label>
                    <a href="#" className="font-semibold text-orange-700 hover:text-orange-800 hover:underline">Forgot password?</a>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'Authenticating...' : (
                    <>Sign In <ArrowRight size={18}/></>
                  )}
                </button>
            </form>

            {/* Footer Note */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Lock size={12} /> Restricted Access — Authorized Personnel Only
              </p>
            </div>
        </div>

        <div className="mt-8 text-center md:hidden">
            <p className="text-xs text-slate-400">© 2025 Rashtrotthana Parishat</p>
        </div>

      </div>
    </div>
  );
};

// Sub-component for Feature Cards
const FeatureCard = ({ icon, title, desc }) => (
  <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-300">
    <div className="p-2 bg-white/10 rounded-lg text-orange-200">
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-white text-sm">{title}</h3>
      <p className="text-xs text-orange-100/80">{desc}</p>
    </div>
  </div>
);

export default Login;