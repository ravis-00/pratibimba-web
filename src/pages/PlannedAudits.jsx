import React, { useState, useEffect } from 'react';
import { Calendar, Plus, User, MapPin, Search, RefreshCw, X, CheckSquare, Square, Edit, Trash2 } from 'lucide-react';

// SIMPLE TOAST COMPONENT
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000); // Auto close after 3s
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-2 animate-fade-in`}>
      <span className="font-bold">{type === 'success' ? 'Success' : 'Error'}:</span> {message}
    </div>
  );
};

const PlannedAudits = () => {
  // 1. STATE DEFINITIONS
  const [plans, setPlans] = useState([]);
  const [prakalpas, setPrakalpas] = useState([]);
  const [users, setUsers] = useState([]); 
  const [dropdowns, setDropdowns] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Toast State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); 
  const [toast, setToast] = useState(null); 

  // Form State
  const initialFormState = {
    audit_id: '', 
    ay_year: '2025-26', 
    location_id: '',
    coordinator_email: '',
    functional_area: '', 
    audit_areas: [], 
    planned_month: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // ⚠️ USE YOUR LATEST DEPLOYED URL
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  };
  const currentUser = getCurrentUser();

  // 2. FETCH DATA
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const payload = { userEmail: currentUser.email };
      
      const [userRes, planRes, locRes, metaRes] = await Promise.all([
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/users', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'audits/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin/prakalpas/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/dropdowns/list', ...payload }) })
      ]);

      const [userData, planData, locData, metaData] = await Promise.all([
        userRes.json(), planRes.json(), locRes.json(), metaRes.json()
      ]);

      if (userData.status === 'success') setUsers(userData.data || []);
      if (planData.status === 'success') setPlans(planData.data || []);
      if (locData.status === 'success') setPrakalpas(locData.data || []);
      if (metaData.status === 'success') setDropdowns(metaData.data || []);

    } catch (e) { console.error(e); showToast(e.message, 'error'); } finally { setLoading(false); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  // 🟢 HELPER: Safely Format Date for Display (Table)
  const formatMonthYear = (dateVal) => {
    if (!dateVal) return '';
    try {
      // Create a date object (handles ISO strings and YYYY-MM)
      const date = new Date(dateVal);
      // Check if valid
      if (isNaN(date.getTime())) return dateVal; // Fallback to original string
      
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch (e) {
      return dateVal;
    }
  };

  // --- ACTIONS HANDLERS ---

  const handleCreate = () => {
    setFormData(initialFormState);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (plan) => {
    // 🟢 FIX: Extract YYYY-MM from the incoming date string
    let safeMonth = '';
    
    if (plan.planned_date) {
      const d = new Date(plan.planned_date);
      if (!isNaN(d.getTime())) {
        // Valid Date Object or String -> Convert to YYYY-MM
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        safeMonth = `${y}-${m}`;
      } else if (typeof plan.planned_date === 'string') {
        // Fallback: If it's a string like "2025-04" or "2025-04-xx"
        safeMonth = plan.planned_date.substring(0, 7);
      }
    }

    setFormData({
      audit_id: plan.audit_id,
      ay_year: plan.ay_year || '2025-26',
      location_id: plan.location_id,
      coordinator_email: plan.coordinator_email,
      functional_area: plan.functional_area,
      audit_areas: plan.audit_areas ? plan.audit_areas.split(',').map(s => s.trim()) : [],
      planned_month: safeMonth // 🟢 Now strictly YYYY-MM
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Are you sure you want to delete Audit ${plan.audit_id}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'audits/delete', 
          userEmail: currentUser.email, 
          audit_id: plan.audit_id 
        })
      });
      const result = await response.json();
      if (result.status === 'success') {
        showToast("Audit deleted successfully.", 'success');
        fetchData();
      } else {
        showToast(result.message, 'error');
      }
    } catch (e) { showToast("Delete failed.", 'error'); } finally { setLoading(false); }
  };

  // --- SMART DROPDOWN LOGIC ---
  const normalize = (str) => (str || '').toLowerCase().trim();

  const getFilteredFunctionalAreas = () => {
    let areas = [...new Set(dropdowns.filter(d => d.category === 'Functional Area').map(d => d.value))];
    if (currentUser.role === 'Audit Coordinator' && currentUser.specialization) {
      const userSpecs = currentUser.specialization.split(',').map(s => normalize(s));
      areas = areas.filter(a => userSpecs.includes(normalize(a)));
    }
    if (formData.location_id) {
      const selectedPrakalpa = prakalpas.find(p => p.prakalpa_id === formData.location_id);
      if (selectedPrakalpa && selectedPrakalpa.applicable_areas) {
        const locAreas = selectedPrakalpa.applicable_areas.split(',').map(s => normalize(s));
        areas = areas.filter(a => locAreas.includes(normalize(a)));
      }
    }
    return areas.sort();
  };

  const availableAuditAreas = dropdowns.filter(d => 
    d.category === 'Audit Area' && normalize(d.parent_value) === normalize(formData.functional_area)
  ).sort((a,b) => (a.display_order || 0) - (b.display_order || 0));

  const getCoordinatorOptions = () => {
    let filtered = users;
    if (!normalize(currentUser.role).includes('admin')) {
      filtered = users.filter(u => u.email === currentUser.email);
    }
    if (formData.functional_area) {
      const selectedArea = normalize(formData.functional_area);
      filtered = filtered.filter(u => normalize(u.role) === 'admin' || normalize(u.specialization).includes(selectedArea));
    }
    return filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  const toggleAuditArea = (areaName) => {
    setFormData(prev => {
      const current = prev.audit_areas;
      if (current.includes(areaName)) return { ...prev, audit_areas: current.filter(a => a !== areaName) };
      else return { ...prev, audit_areas: [...current, areaName] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (formData.audit_areas.length === 0) {
      showToast("Please select at least one specific Audit Area.", 'error');
      setLoading(false);
      return;
    }

    const payload = {
      ay_year: formData.ay_year,
      location_id: formData.location_id,
      coordinator_email: formData.coordinator_email,
      functional_area: formData.functional_area, 
      audit_areas: formData.audit_areas.join(', '),     
      planned_date: formData.planned_month,
      audit_id: formData.audit_id 
    };

    const action = isEditMode ? 'audits/update' : 'audits/create';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, userEmail: currentUser.email, ...payload })
      });
      const result = await response.json();

      if (result.status === 'success') {
        showToast(isEditMode ? "Plan Updated Successfully!" : "Plan Created Successfully!", 'success');
        setIsModalOpen(false);
        fetchData(); 
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) { showToast("Network Error.", 'error'); } finally { setLoading(false); }
  };

  const filteredPlans = plans.filter(p => 
    (p.location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* TOAST NOTIFICATION */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
           <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow">
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
              <th className="px-6 py-4">Planned Date</th> {/* 🟢 NEW COLUMN */}
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan="7" className="p-6 text-center">Loading...</td></tr>}
            {!loading && filteredPlans.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{row.audit_id}</td>
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
                
                {/* 🟢 NEW DATE COLUMN */}
                <td className="px-6 py-4 text-gray-700 font-medium">
                  {formatMonthYear(row.planned_date)}
                </td>

                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Planned' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{row.status}</span></td>
                
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                   <button onClick={() => handleEdit(row)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded" title="Edit">
                     <Edit size={16} />
                   </button>
                   <button onClick={() => handleDelete(row)} className="text-red-400 hover:bg-red-50 p-1.5 rounded" title="Delete">
                     <Trash2 size={16} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <h3 className="font-bold text-lg">{isEditMode ? `Edit Audit (${formData.audit_id})` : 'Create New Audit Plan'}</h3>
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
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value, functional_area: '', audit_areas: []})}>
                  <option value="">-- Choose Prakalpa --</option>
                  {prakalpas.map((p,i) => <option key={i} value={p.prakalpa_id}>{p.prakalpa_name} ({p.place})</option>)}
                </select>
              </div>

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
                  {getFilteredFunctionalAreas().map((f,i) => <option key={i} value={f}>{f}</option>)}
                </select>
              </div>

              {formData.functional_area && (
                <div className="border rounded p-3 bg-gray-50">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Select Specific Audit Areas</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableAuditAreas.length === 0 && <p className="text-xs text-gray-400">No specific areas found.</p>}
                    {availableAuditAreas.map((area, i) => {
                      const isSelected = formData.audit_areas.includes(area.value);
                      return (
                        <div key={i} 
                             className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'}`}
                             onClick={() => toggleAuditArea(area.value)}
                        >
                          {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-400" />}
                          <span className={`text-sm ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-600'}`}>{area.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Assign Coordinator</label>
                <select className="w-full border rounded px-3 py-2 bg-white" required value={formData.coordinator_email} onChange={e => setFormData({...formData, coordinator_email: e.target.value})}>
                  <option value="">-- Choose User --</option>
                  {getCoordinatorOptions().map((u,i) => (
                    <option key={i} value={u.email}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow">
                {loading ? 'Processing...' : (isEditMode ? 'Update Plan' : 'Create Plan')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannedAudits;