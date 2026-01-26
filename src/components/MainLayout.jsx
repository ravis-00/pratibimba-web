import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FilePlus, 
  CalendarCheck, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  Users,    
  Map,      
  Settings, 
  CheckCircle,
  ShieldCheck 
} from 'lucide-react';

const MainLayout = ({ user, onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // DETERMINE USER ROLE
  const currentUser = user || { role: 'Guest', full_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';
  const isAuditee = currentUser.role === 'Auditee';

  // NAVIGATION MENU ITEMS
  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: <LayoutDashboard size={20} />,
      visible: true 
    },
    { 
      name: 'Audit Planning', 
      path: '/planning', 
      icon: <FilePlus size={20} />,
      visible: true 
    },
    { 
      name: 'Scheduled Audits', 
      path: '/scheduled', 
      icon: <CalendarCheck size={20} />,
      visible: !isAuditee 
    },
    { 
      name: 'Open Reports', 
      path: '/reports/open', 
      icon: <FileText size={20} />,
      visible: true 
    },
    { 
      name: 'My Action Items', 
      path: '/action-items', 
      icon: <CheckCircle size={20} />,
      visible: true 
    },
    
    // ADMIN SECTION
    {
      name: 'User Management',
      path: '/admin/users', 
      icon: <Users size={20} />,
      visible: isAdmin
    },
    {
      name: 'Prakalpas', 
      path: '/admin/locations', 
      icon: <Map size={20} />,
      visible: isAdmin
    },
    {
      name: 'System Masters', 
      path: '/admin/masters', 
      icon: <Settings size={20} />,
      visible: isAdmin 
    }
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* =================================================
          📱 MOBILE HEADER
      ================================================= */}
      <div className="md:hidden fixed w-full bg-white border-b border-gray-200 z-20 flex items-center justify-between px-4 h-16 top-0 left-0">
        <div className="flex items-center gap-2">
           {!logoError ? (
              <img src="/logo.png" alt="Logo" className="h-8 w-auto" onError={() => setLogoError(true)}/>
           ) : (
              <ShieldCheck size={24} className="text-orange-600" />
           )}
           <h1 className="text-xl font-bold text-gray-800">Pratibimba</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* =================================================
          🟢 SIDEBAR
      ================================================= */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 
        transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 flex flex-col h-full pt-16 md:pt-0 shadow-xl md:shadow-none
      `}>
        
        {/* 🟢 BRANDING HEADER (Clean White Theme) */}
        <div className="h-24 hidden md:flex items-center px-4 border-b border-gray-200 bg-white">
           <div className="flex items-center gap-3">
              {/* Logo Logic */}
              {!logoError ? (
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="p-1.5 bg-orange-50 rounded-lg">
                   <ShieldCheck size={28} className="text-orange-600" />
                </div>
              )}
              
              <div>
                <h1 className="font-bold text-xl text-gray-900 tracking-tight leading-none">Pratibimba</h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mt-1 leading-snug">
                  Internal Quality Audit <br/> Management System
                </p>
              </div>
           </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
          {menuItems.filter(item => item.visible).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                ${isActive(item.path) 
                  ? 'bg-orange-50 text-orange-700 font-bold border-r-4 border-orange-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <span className={`transition-transform duration-200 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
              </span>
              {item.name}
            </Link>
          ))}
        </nav>

        {/* USER PROFILE & LOGOUT */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3 px-2 py-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold border border-orange-200 shadow-sm">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'No Email'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 rounded-lg transition shadow-sm hover:shadow"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0 pt-16 md:pt-0 bg-gray-50">
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet /> 
        </main>
      </div>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-0 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;