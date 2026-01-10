import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import MainLayout from './components/MainLayout';

// Auth & Dashboard
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Admin Modules
import UserManagement from './pages/UserManagement';
import LocationManagement from './pages/LocationManagement';
import MasterSettings from './pages/MasterSettings';

// Audit Modules
import PlannedAudits from './pages/PlannedAudits';    
import ScheduledAudits from './pages/ScheduledAudits'; 
import OpenReports from './pages/OpenReports';

// Placeholder Forms
const AuditPlanForm = () => <div className="p-10">Form: Create New Audit Plan</div>;
const ScheduleAuditForm = () => <div className="p-10">Form: Schedule an Audit</div>;
const Checklist = () => <div className="p-10">Form: Audit Checklist & Execution</div>;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Auto-Login Check (Runs once on load)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // 2. Define the Login Handler (The missing link!)
  const handleLogin = (userData) => {
    console.log("Login Success:", userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // 3. Define the Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    // No need for window.location.href, React Router will handle the redirect
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* 🟢 FIXED: Passed 'handleLogin' to the Login component */}
        <Route 
          path="/login" 
          element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} 
        />
        
        {/* Protected Routes wrapped in MainLayout */}
        {user && (
          <Route element={<MainLayout user={user} onLogout={handleLogout} />}>
            
            {/* 1. Dashboard */}
            <Route path="/" element={<Dashboard />} />
            
            {/* 2. Audit Planning Module */}
            <Route path="/planning" element={<PlannedAudits />} />
            <Route path="/planning/new" element={<AuditPlanForm />} />
            <Route path="/planning/schedule/:id" element={<ScheduleAuditForm />} />

            {/* 3. Scheduled Audits Module */}
            <Route path="/scheduled" element={<ScheduledAudits />} />
            
            {/* 4. Execution Module */}
            <Route path="/audit/:id/checklist" element={<Checklist />} />

            {/* 5. Reports Module */}
            <Route path="/reports/open" element={<OpenReports />} />

            {/* 6. Admin Modules */}
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/locations" element={<LocationManagement />} />
            <Route path="/admin/masters" element={<MasterSettings />} />
            
          </Route>
        )}
        
        {/* Redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;