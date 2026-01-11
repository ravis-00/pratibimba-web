import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Search, RefreshCw, FileText, Trash2, Edit, X, CheckSquare, Square, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 
import config from '../config';

// SIMPLE TOAST COMPONENT
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
  const [prakalpas, setPrakalpas] = useState([]); // 🟢 NEW: Store Master Prakalpas
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Toast State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [scheduleData, setScheduleData] = useState({
      audit_id: '',
      prakalpa_name: '', 
      location_id: '', 
      start_date: '',
      end_date: '',
      time_from: '',
      time_to: '',
      assigned_auditors: [],
      assigned_auditees: [] 
  });

  const navigate = useNavigate(); 
  const API_URL = config.API_URL;
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const payload = { userEmail: currentUser?.email };
      
      // 🟢 UPDATED: Fetch Prakalpas Master List too
      const [auditRes, userRes, locRes] = await Promise.all([
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'audits/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/users', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin/prakalpas/list', ...payload }) })
      ]);

      const [auditData, userData, locData] = await Promise.all([auditRes.json(), userRes.json(), locRes.json()]);

      if (auditData.status === 'success') {
        const scheduledOnly = (auditData.data || []).filter(a => a.status === 'Scheduled');
        setAudits(scheduledOnly);
      }
      if (userData.status === 'success') setUsers(userData.data || []);
      if (locData.status === 'success') setPrakalpas(locData.data || []); // 🟢 Store Prakalpas

    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to load data", 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return 'Date not set';
    try {
      const s = new Date(start).toLocaleDateString();
      const e = new Date(end).toLocaleDateString();
      return `${s} - ${e}`;
    } catch (e) { return 'Invalid Date'; }
  };

  // --- ACTIONS ---

  const handleDelete = async (audit) => {
    if (!window.confirm(`Are you sure you want to delete Audit ${audit.audit_id}? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'audits/delete', userEmail: currentUser.email, audit_id: audit.audit_id })
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

  const handleEditSchedule = (row) => {
    let tFrom = '', tTo = '';
    if (row.schedule_time && row.schedule_time.includes('-')) {
        const parts = row.schedule_time.split('-').map(s => s.trim());
        tFrom = parts[0];
        tTo = parts[1];
    }

    setScheduleData({
      audit_id: row.audit_id,
      prakalpa_name: row.location_name,
      location_id: row.location_id, 
      start_date: row.schedule_start_date ? new Date(row.schedule_start_date).toISOString().split('T')[0] : '',
      end_date: row.schedule_end_date ? new Date(row.schedule_end_date).toISOString().split('T')[0] : '',
      time_from: tFrom,
      time_to: tTo,
      assigned_auditors: row.assigned_auditors ? row.assigned_auditors.split(',').map(s => s.trim()) : [],
      assigned_auditees: row.assigned_auditees ? row.assigned_auditees.split(',').map(s => s.trim()) : []
    });
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
        audit_id: scheduleData.audit_id,
        start_date: scheduleData.start_date,
        end_date: scheduleData.end_date,
        time: `${scheduleData.time_from} - ${scheduleData.time_to}`,
        auditors: scheduleData.assigned_auditors.join(', '),
        auditees: scheduleData.assigned_auditees.join(', ')
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'audits/schedule', userEmail: currentUser.email, ...payload })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast("✅ Audit Rescheduled Successfully!", 'success');
            setIsRescheduleModalOpen(false);
            fetchData();
        } else {
            showToast(result.message, 'error');
        }
    } catch (e) { showToast("Network Error", 'error'); } finally { setLoading(false); }
  };

  const handleConductAudit = (auditId) => {
    navigate(`/audit/execute/${auditId}`);
  };

  // --- HELPERS ---
  const normalize = (str) => (str || '').toLowerCase().trim();

  const getAuditorOptions = () => {
    return users.filter(u => {
        const r = normalize(u.role);
        return r.includes('coordinator') || r.includes('auditor') || r.includes('admin');
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  // 🟢 SMART FILTER: Links ID (PRK005) to Name (JGRV)
  const getAuditeeOptions = () => {
      // 1. Get the Plan's Location ID (PRK005)
      const targetId = normalize(scheduleData.location_id);
      
      // 2. Find the Prakalpa Name using the Master List
      const targetPrakalpa = prakalpas.find(p => normalize(p.prakalpa_id) === targetId);
      const targetName = targetPrakalpa ? normalize(targetPrakalpa.prakalpa_name) : '';

      return users.filter(u => {
          const r = normalize(u.role);
          const isAuditee = r.includes('auditee');
          
          // 3. Compare User's Prakalpa Name vs. Target Name
          const userPrakalpaName = normalize(u.prakalpa_name);
          const matches = userPrakalpaName === targetName;

          return isAuditee && matches; 
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  const toggleList = (listType, email) => {
    setScheduleData(prev => {
        const current = prev[listType];
        if (current.includes(email)) return { ...prev, [listType]: current.filter(e => e !== email) };
        else return { ...prev, [listType]: [...current, email] };
    });
  };

  const filteredAudits = audits.filter(a => 
    (a.location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
              <th className="px-6 py-4">Audit Focus</th>
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
                    <MapPin size={14} className="text-gray-400"/> {row.location_name}
                  </div>
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="font-bold text-gray-700 mb-1">{row.functional_area}</div>
                  <ul className="list-disc list-inside text-xs text-gray-500">
                    {row.audit_areas ? row.audit_areas.split(',').map((area, idx) => (
                        <li key={idx} className="truncate max-w-[200px]">{area.trim()}</li>
                    )) : <li>General</li>}
                  </ul>
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
                     <div className="text-xs text-gray-600">
                        <strong className="flex items-center gap-1"><Users size={10} className="text-blue-500"/> Auditors:</strong>
                        <div className="truncate max-w-[150px] pl-3">{row.assigned_auditors || 'None'}</div>
                     </div>
                     <div className="text-xs text-gray-600">
                        <strong className="flex items-center gap-1"><Users size={10} className="text-orange-500"/> Auditees:</strong>
                        <div className="truncate max-w-[150px] pl-3">{row.assigned_auditees || 'None'}</div>
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
                            <button onClick={() => handleDelete(row)} className="text-red-400 hover:bg-red-50 p-1.5 rounded border" title="Delete">
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
              <div className="bg-gray-50 p-3 rounded border text-sm text-gray-600">
                <p><strong>Prakalpa:</strong> {scheduleData.prakalpa_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                    <input type="date" required className="w-full border rounded px-3 py-2" value={scheduleData.start_date} onChange={e => setScheduleData({...scheduleData, start_date: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                    <input type="date" required className="w-full border rounded px-3 py-2" min={scheduleData.start_date} value={scheduleData.end_date} onChange={e => setScheduleData({...scheduleData, end_date: e.target.value})} />
                 </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Audit Time (From - To)</label>
                  <div className="flex items-center gap-2">
                     <input type="time" required className="w-full border rounded px-3 py-2" value={scheduleData.time_from} onChange={e => setScheduleData({...scheduleData, time_from: e.target.value})} />
                     <span className="text-gray-400">-</span>
                     <input type="time" required className="w-full border rounded px-3 py-2" value={scheduleData.time_to} onChange={e => setScheduleData({...scheduleData, time_to: e.target.value})} />
                  </div>
              </div>

              <div className="border rounded p-3 bg-white">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditors</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getAuditorOptions().map((user, i) => {
                      const isSelected = scheduleData.assigned_auditors.includes(user.email);
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-100'}`} onClick={() => toggleList('assigned_auditors', user.email)}>
                          {isSelected ? <CheckSquare size={16} className="text-purple-600" /> : <Square size={16} className="text-gray-400" />}
                          <span className={`text-sm ${isSelected ? 'text-purple-800 font-medium' : 'text-gray-600'}`}>{user.full_name}</span>
                        </div>
                      );
                    })}
                  </div>
              </div>

              <div className="border rounded p-3 bg-white">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditees</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getAuditeeOptions().length === 0 && <p className="text-xs text-red-400 p-2">No auditees found for location.</p>}
                    {getAuditeeOptions().map((user, i) => {
                      const isSelected = scheduleData.assigned_auditees.includes(user.email);
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'}`} onClick={() => toggleList('assigned_auditees', user.email)}>
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