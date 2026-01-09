import React, { useState, useEffect } from 'react';
import { Calendar, Plus, User, MapPin, Search, RefreshCw, X } from 'lucide-react';

const PlannedAudits = () => {
  // 1. STATE DEFINITIONS
  const [plans, setPlans] = useState([]);
  const [prakalpas, setPrakalpas] = useState([]);
  const [users, setUsers] = useState([]); 
  const [dropdowns, setDropdowns] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    ay_year: '2025-26', 
    location_id: '',
    coordinator_email: '',
    functional_area: '', 
    planned_month: ''
  });

  // ⚠️ USE YOUR LATEST DEPLOYED URL
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  };

  // 2. FETCH DATA EFFECT
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      setLoading(true);
      
      // A. Fetch Users
      const userRes = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'meta/users', userEmail: user.email }) 
      });
      const userData = await userRes.json();
      if (userData.status === 'success') {
        // 🟢 DEBUG LOG: Check what roles are actually coming from the database
        console.log("✅ Loaded Users:", userData.data);
        setUsers(userData.data || []);
      }

      // B. Fetch Plans
      const planRes = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'audit/list', userEmail: user.email }) 
      });
      const planData = await planRes.json();
      if (planData.status === 'success') setPlans(planData.data || []);

      // C. Fetch Prakalpas
      const locRes = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'admin/prakalpas/list', userEmail: user.email }) 
      });
      const locData = await locRes.json();
      if (locData.status === 'success') setPrakalpas(locData.data || []);

      // D. Fetch Dropdowns
      const metaRes = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'meta/dropdowns/list', userEmail: user.email }) 
      });
      const metaData = await metaRes.json();
      if (metaData.status === 'success') setDropdowns(metaData.data || []);

    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  // 3. HELPER LOGIC
  const functionalAreas = dropdowns.filter(d => d.category === 'Functional Area');
  
  // 🟢 UPDATED SMART FILTER
  const getCoordinatorOptions = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !users.length) return [];

    const currentRole = (currentUser.role || '').toLowerCase().trim();
    let filtered = [];

    console.log("🕵️ Filtering for Current Role:", currentRole);

    // 1. If Admin: Show Admins AND anyone with "Coordinator" in their role
    if (currentRole.includes('admin')) {
      filtered = users.filter(u => {
        const r = (u.role || '').toLowerCase();
        // ✅ LOOSE MATCHING: Checks if the word exists inside the string
        return r.includes('admin') || r.includes('coordinator');
      });
    }
    // 2. If Coordinator: Show ONLY themselves
    else if (currentRole.includes('coordinator')) {
      filtered = users.filter(u => u.email === currentUser.email);
    }
    // 3. Fallback: Show only themselves
    else {
      filtered = users.filter(u => u.email === currentUser.email);
    }

    // ⚠️ SAFETY NET: If filter results in 0 (e.g. typos in DB), show EVERYONE so you aren't blocked.
    if (filtered.length === 0) {
      console.warn("⚠️ Filter returned 0 results. Showing ALL users as fallback.");
      return users;
    }

    return filtered;
  };

  const coordinatorOptions = getCoordinatorOptions();

  // 4. SUBMIT HANDLER
  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    setLoading(true);

    const payload = {
      ay_year: formData.ay_year,
      location_id: formData.location_id,
      coordinator_email: formData.coordinator_email,
      audit_areas: formData.functional_area, 
      planned_date: formData.planned_month
    };

    try {
      await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'audit/create', userEmail: user.email, ...payload })
      });
      setIsModalOpen(false);
      fetchData(); 
    } catch (error) { 
      alert("Error saving."); 
    } finally { 
      setLoading(false); 
    }
  };

  const filteredPlans = plans.filter(p => 
    (p.location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-blue-600" /> Audit Planning
        </h1>
        
        <div className="flex gap-2">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input type="text" placeholder="Search Plans..." 
               className="pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded"><RefreshCw size={20}/></button>
           <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow">
             <Plus size={18} /> Create Plan
           </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Audit ID</th>
              <th className="px-6 py-4">Prakalpa</th>
              <th className="px-6 py-4">Area</th>
              <th className="px-6 py-4">Coordinator</th>
              <th className="px-6 py-4">Planned</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan="6" className="p-6 text-center">Loading...</td></tr>}
            {!loading && filteredPlans.length === 0 && <tr><td colSpan="6" className="p-6 text-center">No plans found.</td></tr>}
            {!loading && filteredPlans.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs text-gray-400">{row.audit_id}</td>
                <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-400"/> {row.location_name}
                </td>
                <td className="px-6 py-4 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit">{row.audit_areas}</td>
                <td className="px-6 py-4 flex items-center gap-2"><User size={14} className="text-gray-400"/> {row.coordinator_name || row.coordinator_email}</td>
                <td className="px-6 py-4">{row.planned_date}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Planned' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">Create New Audit Plan</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 mb-1">Academic Year</label>
                   <select className="w-full border rounded px-3 py-2" value={formData.ay_year} onChange={e => setFormData({...formData, ay_year: e.target.value})}>
                     <option>2025-26</option>
                     <option>2026-27</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 mb-1">Planned Month</label>
                   <input type="month" className="w-full border rounded px-3 py-2" required value={formData.planned_month} onChange={e => setFormData({...formData, planned_month: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Select Prakalpa</label>
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                  <option value="">-- Choose Prakalpa --</option>
                  {prakalpas.map((p,i) => <option key={i} value={p.prakalpa_id}>{p.prakalpa_name} ({p.place})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Audit Functional Area</label>
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.functional_area} onChange={e => setFormData({...formData, functional_area: e.target.value})}>
                  <option value="">-- Choose Area --</option>
                  {functionalAreas.map((f,i) => <option key={i} value={f.value}>{f.value}</option>)}
                </select>
              </div>

              {/* 🟢 COORDINATOR DROPDOWN */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Assign Coordinator</label>
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.coordinator_email} onChange={e => setFormData({...formData, coordinator_email: e.target.value})}>
                  <option value="">-- Choose User --</option>
                  {coordinatorOptions.map((u,i) => (
                    <option key={i} value={u.email}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow">
                {loading ? 'Saving...' : 'Create Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannedAudits;