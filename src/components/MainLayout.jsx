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
  Users, // 👈 Added this
  Map    // 👈 Added this
} from 'lucide-react';

const MainLayout = ({ user, onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🟢 NAVIGATION MENU ITEMS
  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: <LayoutDashboard size={20} /> 
    },
    { 
      name: 'Audit Planning', 
      path: '/planning', 
      icon: <FilePlus size={20} /> 
    },
    { 
      name: 'Scheduled Audits', 
      path: '/scheduled', 
      icon: <CalendarCheck size={20} /> 
    },
    { 
      name: 'Open Reports', 
      path: '/reports/open', 
      icon: <FileText size={20} /> 
    },
    // 👇 ADMIN SECTION
    {
      name: 'User Management',
      path: '/admin/users',
      icon: <Users size={20} />
    },
    {
      name: 'Locations',
      path: '/admin/locations',
      icon: <Map size={20} />
    }
  ];

  // Helper to check if a route is active (includes sub-routes)
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* 📱 MOBILE HEADER */}
      <div className="md:hidden fixed w-full bg-white border-b border-gray-200 z-20 flex items-center justify-between px-4 h-16 top-0 left-0">
        <h1 className="text-xl font-bold text-blue-700">Pratibimba</h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* 🟢 SIDEBAR */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 
        transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 flex flex-col h-full pt-16 md:pt-0
      `}>
        
        {/* Logo Section */}
        <div className="h-16 hidden md:flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-700">Pratibimba</h1>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive(item.path) 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3 px-4 py-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'No Email'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 rounded-lg transition shadow-sm"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* 🔵 MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0 pt-16 md:pt-0">
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet /> 
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-0 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;