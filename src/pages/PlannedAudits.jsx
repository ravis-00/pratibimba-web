import React, { useState, useEffect } from 'react';
import { Calendar, Plus, User, MapPin, Search, RefreshCw, X, CheckSquare, Square } from 'lucide-react';

const PlannedAudits = () => {
  // 1. STATE DEFINITIONS
  const [plans, setPlans] = useState([]);
  const [prakalpas, setPrakalpas] = useState([]);
  const [users, setUsers] = useState([]); 
  const [dropdowns, setDropdowns] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    ay_year: '2025-26', 
    location_id: '',
    coordinator_email: '',
    functional_area: '', 
    audit_areas: [], // Array for Multi-Select
    planned_month: ''
  });

  // ⚠️ USE YOUR LATEST DEPLOYED URL
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  };

  const currentUser = getCurrentUser();

  // 2. FETCH DATA EFFECT
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      
      const payload = { userEmail: currentUser.email };
      
      // Parallel Fetch for speed
      const [userRes, planRes, locRes, metaRes] = await Promise.all([
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/users', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'audits/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin/prakalpas/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/dropdowns/list', ...payload }) })
      ]);

      const [userData, planData, locData, metaData] = await Promise.all([
        userRes.json(), planRes.json(), locRes.json(), metaRes.json()
      ]);

      if (userData.status === 'success') {
         // Debug: Ensure backend is sending specialization
         console.log("Users Loaded:", userData.data); 
         setUsers(userData.data || []);
      }
      if (planData.status === 'success') setPlans(planData.data || []);
      if (locData.status === 'success') setPrakalpas(locData.data || []);
      if (metaData.status === 'success') setDropdowns(metaData.data || []);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- 🟢 SMART LOGIC START ---

  // 1. Get Functional Areas (Filtered by User Role & Selected Prakalpa)
  const getFilteredFunctionalAreas = () => {
    // A. Start with all areas from Master Dropdowns
    let areas = [...new Set(dropdowns
      .filter(d => d.category === 'Functional Area')
      .map(d => d.value)
    )];

    // B. Filter by USER SPECIALIZATION (if Audit Coordinator is creating the plan)
    if (currentUser.role === 'Audit Coordinator' && currentUser.specialization) {
      const userSpecs = currentUser.specialization.split(',').map(s => s.trim());
      areas = areas.filter(a => userSpecs.includes(a));
    }

    // C. Filter by PRAKALPA (if selected)
    if (formData.location_id) {
      const selectedPrakalpa = prakalpas.find(p => p.prakalpa_id === formData.location_id);
      if (selectedPrakalpa && selectedPrakalpa.applicable_areas) {
        const locAreas = selectedPrakalpa.applicable_areas.split(',').map(s => s.trim());
        areas = areas.filter(a => locAreas.includes(a));
      }
    }

    return areas.sort();
  };

  const filteredFunctionalAreas = getFilteredFunctionalAreas();

  // 2. Get Audit Areas (Filtered by selected Functional Area)
  const availableAuditAreas = dropdowns.filter(d => 
    d.category === 'Audit Area' && 
    d.linked_functional_area === formData.functional_area
  ).sort((a,b) => (a.order || 0) - (b.order || 0));

  // 3. Coordinator Logic (🟢 UPDATED: Filters by Specialization)
  const getCoordinatorOptions = () => {
    const currentRole = (currentUser.role || '').toLowerCase().trim();
    let filtered = [];

    // Step A: Basic Role Filtering
    if (currentRole.includes('admin')) {
      filtered = users.filter(u => {
        const r = (u.role || '').toLowerCase();
        return r.includes('admin') || r.includes('coordinator');
      });
    } else {
      // Coordinators can only assign themselves
      filtered = users.filter(u => u.email === currentUser.email);
    }

    // Step B: Specialization Filtering (The Safety Check)
    // If a Functional Area is selected, ONLY show users who specialize in it
    if (formData.functional_area) {
      const selectedArea = formData.functional_area.trim().toLowerCase();
      
      filtered = filtered.filter(u => {
        // Admins are always eligible
        if ((u.role || '').toLowerCase() === 'admin') return true;

        // Check user specialization
        const userSpec = (u.specialization || '').trim().toLowerCase();
        
        // Match: Exact match OR contains (if comma separated)
        return userSpec === selectedArea || userSpec.includes(selectedArea);
      });
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  const coordinatorOptions = getCoordinatorOptions();

  // --- 🟢 SMART LOGIC END ---

  // Toggle Checkbox for Audit Areas
  const toggleAuditArea = (areaName) => {
    setFormData(prev => {
      const current = prev.audit_areas;
      if (current.includes(areaName)) {
        return { ...prev, audit_areas: current.filter(a => a !== areaName) };
      } else {
        return { ...prev, audit_areas: [...current, areaName] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate: At least one audit area must be selected
    if (formData.audit_areas.length === 0) {
      alert("⚠️ Please select at least one specific Audit Area.");
      setLoading(false);
      return;
    }

    const payload = {
      ay_year: formData.ay_year,
      location_id: formData.location_id,
      coordinator_email: formData.coordinator_email,
      functional_area: formData.functional_area, 
      // Join array into string for storage "Area1, Area2"
      audit_areas: formData.audit_areas.join(', '),     
      planned_date: formData.planned_month
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'audits/create', userEmail: currentUser.email, ...payload })
      });
      const result = await response.json();

      if (result.status === 'success') {
        alert("✅ Audit Plan Created Successfully!"); 
        setIsModalOpen(false);
        // Reset Form
        setFormData({ 
            ay_year: '2025-26', 
            location_id: '',
            coordinator_email: '',
            functional_area: '', 
            audit_areas: [], 
            planned_month: ''
        });
        fetchData(); 
      } else {
        alert("❌ Error: " + result.message); 
      }
    } catch (error) { 
      alert("❌ Network Error. Please try again."); 
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

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Audit ID</th>
              <th className="px-6 py-4">Prakalpa</th>
              <th className="px-6 py-4">Functional Area</th>
              <th className="px-6 py-4">Coordinator</th>
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
                <td className="px-6 py-4">
                    <div className="font-bold text-gray-700">{row.functional_area}</div>
                    <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={row.audit_areas}>
                      {row.audit_areas}
                    </div>
                </td>
                <td className="px-6 py-4 flex items-center gap-2"><User size={14} className="text-gray-400"/> {row.coordinator_name || row.coordinator_email}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Planned' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <h3 className="font-bold text-lg">Create New Audit Plan</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Year & Month */}
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
              
              {/* Prakalpa Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Select Prakalpa</label>
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value, functional_area: '', audit_areas: []})}>
                  <option value="">-- Choose Prakalpa --</option>
                  {prakalpas.map((p,i) => <option key={i} value={p.prakalpa_id}>{p.prakalpa_name} ({p.place})</option>)}
                </select>
              </div>

              {/* Functional Area (Filtered) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Functional Area</label>
                <select 
                  className={`w-full border rounded px-3 py-2 ${!formData.location_id ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  required 
                  disabled={!formData.location_id}
                  value={formData.functional_area} 
                  onChange={e => setFormData({...formData, functional_area: e.target.value, audit_areas: []})} 
                >
                  <option value="">
                    {!formData.location_id ? "-- Select Prakalpa First --" : "-- Choose Functional Area --"}
                  </option>
                  {filteredFunctionalAreas.map((f,i) => <option key={i} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Audit Areas (Multi-Select Checkboxes) */}
              {formData.functional_area && (
                <div className="border rounded p-3 bg-gray-50">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Select Specific Audit Areas</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableAuditAreas.length === 0 && <p className="text-xs text-gray-400">No specific areas found for this category.</p>}
                    
                    {availableAuditAreas.map((area, i) => {
                      const isSelected = formData.audit_areas.includes(area.value);
                      return (
                        <div key={i} 
                             className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'}`}
                             onClick={() => toggleAuditArea(area.value)}
                        >
                          {isSelected 
                            ? <CheckSquare size={18} className="text-blue-600" /> 
                            : <Square size={18} className="text-gray-400" />
                          }
                          <span className={`text-sm ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-600'}`}>
                            {area.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coordinator (Smart Filtered) */}
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
                {/* Helper text if list is empty */}
                {formData.functional_area && coordinatorOptions.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No coordinators found with specialization: {formData.functional_area}</p>
                )}
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