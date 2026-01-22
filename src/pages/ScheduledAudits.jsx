import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Search, RefreshCw, Trash2, Edit, X, CheckSquare, Square, PlayCircle, UserCheck, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../supabase';

// Simple Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000); 
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-2 animate-fade-in`}>
      <span className="font-bold">{type === 'success' ? 'Success' : 'Error'}:</span> {message}
    </div>
  );
};

const ScheduledAudits = () => {
  const [audits, setAudits] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Toast State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [scheduleData, setScheduleData] = useState({
      audit_id: '',
      prakalpa_name: '', 
      functional_area: '',
      coordinator_name: '', // 🟢 Added Coordinator Name to State
      schedule_start_date: '',
      schedule_end_date: '',
      schedule_time: '', 
      assigned_auditors: '', 
      assigned_auditees: [] 
  });

  const navigate = useNavigate(); 

  // =========================
  // 1. HELPERS
  // =========================
  
  // Safely parse dates
  const toInputDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) {
            const parts = dateString.split('-');
            if (parts.length === 3 && parts[2].length === 4) {
               return `${parts[2]}-${parts[1]}-${parts[0]}`; 
            }
            return ""; 
        }
        return d.toISOString().split('T')[0];
    } catch (e) { return ""; }
  };

  const formatDateRange = (start, end) => {
    if (!start) return 'Date not set';
    try {
      const d1 = new Date(start);
      const d2 = end ? new Date(end) : d1;
      
      if(isNaN(d1.getTime())) return `${start} - ${end || start}`; 

      const s = d1.toLocaleDateString();
      const e = d2.toLocaleDateString();
      return `${s} - ${e}`;
    } catch (e) { return 'Invalid Date'; }
  };

  const normalize = (str) => (str || '').toLowerCase().trim();

  // =========================
  // 2. DATA FETCHING
  // =========================
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: auditData, error: auditError } = await supabase
        .from('audit_plan')
        .select('*')
        .eq('status', 'Scheduled')
        .order('schedule_start_date', { ascending: true });

      if (auditError) throw auditError;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, email, role, prakalpa_name')
        .eq('status', 'Active');

      if (userError) throw userError;

      setAudits(auditData || []);
      setUsers(userData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to load data: " + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  // =========================
  // 3. ACTIONS
  // =========================

  const handleDelete = async (auditId) => {
    if (!window.confirm(`Are you sure you want to delete Audit ${auditId}? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase.from('audit_plan').delete().eq('audit_id', auditId);
      if (error) throw error;
      showToast("Audit deleted successfully.", 'success');
      setAudits(prev => prev.filter(a => a.audit_id !== auditId));
    } catch (e) { showToast("Delete failed: " + e.message, 'error'); }
  };

  const handleEditSchedule = (row) => {
    setScheduleData({
      audit_id: row.audit_id,
      prakalpa_name: row.prakalpa_name,
      functional_area: row.functional_area,
      coordinator_name: row.coordinator_name || '', // 🟢 Map Coordinator Name
      schedule_start_date: toInputDate(row.schedule_start_date || row.planned_date),
      schedule_end_date: toInputDate(row.schedule_end_date || row.planned_date),
      schedule_time: row.schedule_time || '',
      assigned_auditors: row.assigned_auditors || '',
      assigned_auditees: row.assigned_auditees ? row.assigned_auditees.split(',').map(s => s.trim()) : []
    });
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
        schedule_start_date: scheduleData.schedule_start_date,
        schedule_end_date: scheduleData.schedule_end_date,
        schedule_time: scheduleData.schedule_time,
        assigned_auditors: scheduleData.assigned_auditors,
        assigned_auditees: scheduleData.assigned_auditees.join(', ')
    };

    try {
        const { error } = await supabase.from('audit_plan').update(payload).eq('audit_id', scheduleData.audit_id);
        if (error) throw error;
        showToast("✅ Audit Rescheduled Successfully!", 'success');
        setIsRescheduleModalOpen(false);
        fetchData(); 
    } catch (e) { showToast("Update failed: " + e.message, 'error'); } finally { setLoading(false); }
  };

  const handleConductAudit = (auditId) => {
    navigate(`/audit/execute/${auditId}`);
  };

  // --- FILTER HELPERS ---

  const getAuditorOptions = () => {
    return users.filter(u => {
        const r = normalize(u.role);
        return r.includes('coordinator') || r.includes('auditor') || r.includes('admin');
    }).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  };

  const getAuditeeOptions = () => {
      const targetName = normalize(scheduleData.prakalpa_name);

      return users.filter(u => {
          const r = normalize(u.role);
          const isEligible = r.includes('auditee') || r.includes('coordinator'); 
          
          const userPrakalpa = normalize(u.prakalpa_name);
          const matches = userPrakalpa === targetName;

          return isEligible && matches; 
      }).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  };

  const toggleList = (listType, name) => {
    setScheduleData(prev => {
        const current = prev[listType];
        if (current.includes(name)) return { ...prev, [listType]: current.filter(e => e !== name) };
        else return { ...prev, [listType]: [...current, name] };
    });
  };

  const filteredAudits = audits.filter(a => 
    (a.prakalpa_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="text-purple-600" /> Scheduled Audits
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage schedules and conduct audits.</p>
        </div>
        
        <div className="flex gap-2">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input type="text" placeholder="Search Location or ID..." 
               className="pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded" title="Refresh">
             <RefreshCw size={20}/>
           </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Audit ID</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Functional Area</th>
              <th className="px-6 py-4">Schedule</th>
              <th className="px-6 py-4">Team</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan="6" className="p-6 text-center">Loading...</td></tr>}
            {!loading && filteredAudits.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">No scheduled audits found.</td></tr>
            )}
            
            {!loading && filteredAudits.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs text-purple-600 font-bold align-top">{row.audit_id}</td>
                
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-2 font-bold text-gray-800">
                    <MapPin size={14} className="text-gray-400"/> {row.prakalpa_name}
                  </div>
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="font-bold text-gray-700 mb-1">{row.functional_area}</div>
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700">{formatDateRange(row.schedule_start_date, row.schedule_end_date)}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                       <Clock size={10}/> {row.schedule_time || 'All Day'}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col gap-2">
                      <div className="text-xs text-gray-700">
                        <strong className="flex items-center gap-1 text-gray-500"><UserCheck size={12} className="text-green-600"/> Coordinator:</strong>
                        <div className="pl-4 font-medium">{row.coordinator_name || '-'}</div>
                      </div>
                      
                      <div className="text-xs text-gray-700">
                        <strong className="flex items-center gap-1 text-gray-500"><Users size={12} className="text-blue-500"/> Auditors:</strong>
                        <div className="pl-4">{row.assigned_auditors || '-'}</div>
                      </div>
                      
                      <div className="text-xs text-gray-700">
                        <strong className="flex items-center gap-1 text-gray-500"><User size={12} className="text-orange-500"/> Auditees:</strong>
                        <div className="pl-4">{row.assigned_auditees || '-'}</div>
                      </div>
                  </div>
                </td>

                <td className="px-6 py-4 text-right align-top">
                    <div className="flex flex-col gap-2 items-end">
                        <button onClick={() => handleConductAudit(row.audit_id)} 
                               className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 hover:bg-purple-700 shadow-sm w-full justify-center">
                          <PlayCircle size={14}/> Conduct Audit
                        </button>

                        <div className="flex gap-2">
                            <button onClick={() => handleEditSchedule(row)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded border" title="Reschedule">
                                <Edit size={14} />
                            </button>
                            <button onClick={() => handleDelete(row.audit_id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded border" title="Delete">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RESCHEDULE MODAL */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-purple-700 flex items-center gap-2">
                 <Edit size={20}/> Reschedule ({scheduleData.audit_id})
              </h3>
              <button onClick={() => setIsRescheduleModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded border text-sm text-gray-600 flex justify-between">
                <p><strong>Prakalpa:</strong> {scheduleData.prakalpa_name}</p>
                <p><strong>Area:</strong> {scheduleData.functional_area}</p>
              </div>

              {/* 🟢 NEW: Read-Only Coordinator Field */}
              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Audit Coordinator</label>
                  <input className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" readOnly value={scheduleData.coordinator_name} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                    <input type="date" required className="w-full border rounded px-3 py-2" value={scheduleData.schedule_start_date} onChange={e => setScheduleData({...scheduleData, schedule_start_date: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                    <input type="date" required className="w-full border rounded px-3 py-2" min={scheduleData.schedule_start_date} value={scheduleData.schedule_end_date} onChange={e => setScheduleData({...scheduleData, schedule_end_date: e.target.value})} />
                 </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Audit Time (e.g. 10:00 AM - 2:00 PM)</label>
                  <input type="text" className="w-full border rounded px-3 py-2" placeholder="Enter time range" value={scheduleData.schedule_time} onChange={e => setScheduleData({...scheduleData, schedule_time: e.target.value})} />
              </div>

              {/* Assign Auditors (Manual) */}
              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditors (Names)</label>
                  <textarea 
                      className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      rows="2"
                      placeholder="Enter auditor names separated by comma"
                      value={scheduleData.assigned_auditors}
                      onChange={(e) => setScheduleData({...scheduleData, assigned_auditors: e.target.value})}
                  ></textarea>
              </div>

              {/* Assign Auditees */}
              <div className="border rounded p-3 bg-white">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditees (Matching Location)</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getAuditeeOptions().length === 0 && <p className="text-xs text-red-400 p-2">No users found for {scheduleData.prakalpa_name}.</p>}
                    {getAuditeeOptions().map((user, i) => {
                      const isSelected = scheduleData.assigned_auditees.includes(user.full_name);
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'}`} onClick={() => toggleList('assigned_auditees', user.full_name)}>
                          {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}
                          <span className={`text-sm ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-600'}`}>{user.full_name}</span>
                        </div>
                      );
                    })}
                  </div>
              </div>

              <button disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition shadow">
                {loading ? 'Saving...' : 'Update Schedule'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ScheduledAudits;