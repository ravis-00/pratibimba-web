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
import AuditExecution from './pages/AuditExecution'; 
import ActionItems from './pages/ActionItems'; // 🟢 1. IMPORT CAPA MODULE
import CreateAuditPlan from './pages/CreateAuditPlan';

// Placeholder Forms (Kept these for now if you haven't built them yet)

const ScheduleAuditForm = () => <div className="p-10">Form: Schedule an Audit</div>;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Auto-Login Check
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // 2. Login Handler
  const handleLogin = (userData) => {
    console.log("Login Success:", userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // 3. Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
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
        
            <Route path="/planning/schedule/:id" element={<ScheduleAuditForm />} />
            <Route path="/planning/new" element={<CreateAuditPlan />} />

            {/* 3. Scheduled Audits Module */}
            <Route path="/scheduled" element={<ScheduledAudits />} />
            
            {/* 4. Execution Module */}
            <Route path="/audit/execute/:auditId" element={<AuditExecution />} />

            {/* 5. Reports Module */}
            <Route path="/reports/open" element={<OpenReports />} />

            {/* 6. CAPA Module (My Action Items) */}
            {/* 🟢 2. ADD THE ROUTE HERE */}
            <Route path="/action-items" element={<ActionItems />} />

            {/* 7. Admin Modules */}
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/locations" element={<LocationManagement />} />
            <Route path="/admin/masters" element={<MasterSettings />} />
            
            
          </Route>
        )}
        
        {/* Redirect unknown routes to login */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;