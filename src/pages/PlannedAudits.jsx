import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Search, RefreshCw, Calendar, MapPin, User, Trash2,
  CalendarClock, Filter, X, ChevronLeft, ChevronRight,
  Download, ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit3, Save, Archive, CheckSquare, Square, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const PlannedAudits = () => {
  const navigate = useNavigate();

  // 🟢 CALCULATE CURRENT AY (e.g. "2025-26")
  const getCurrentAY = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0=Jan
    const startYear = month < 3 ? year - 1 : year;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  // =========================
  // 1. STATE MANAGEMENT
  // =========================
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]); 
  const [masterAuditAreas, setMasterAuditAreas] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Pagination
  const [ayFilter, setAyFilter] = useState(getCurrentAY());
  const [availableYears, setAvailableYears] = useState([getCurrentAY()]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "audit_id", direction: "descending" });

  // Modals
  const [viewData, setViewData] = useState(null);
  const [editData, setEditData] = useState(null);

  // Form State
  const [editForm, setEditForm] = useState({
    schedule_start_date: "",
    schedule_end_date: "",
    schedule_time: "",
    prakalpa_name: "", 
    functional_area: "",
    coordinator_name: "", 
    selected_audit_areas: [],
    assigned_auditors: "", 
    assigned_auditees: [], 
    status: "Planned"
  });

  // =========================
  // 2. HELPERS
  // =========================
  const toInputDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) {
            const parts = dateString.split('-');
            if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return ""; 
        }
        return d.toISOString().split('T')[0];
    } catch (e) { return ""; }
  };

  const formatDate = (ds) => { 
    if(!ds) return "-"; 
    const d = new Date(ds); 
    if (isNaN(d.getTime())) return ds; 
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; 
  };

  const getStatusColor = (s) => {
    switch (s) {
      case "Completed": return "bg-purple-100 text-purple-700 border-purple-200";
      case "Scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }
  };
  const csvEscape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const normalize = (str) => (str || '').toLowerCase().trim();

  // =========================
  // 3. API ACTIONS
  // =========================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Years
      const { data: yearData } = await supabase.from('audit_plan').select('ay_year');
      if (yearData) {
        const years = [...new Set(yearData.map(y => y.ay_year).filter(Boolean))].sort().reverse();
        if (years.length > 0) setAvailableYears(years);
      }

      // 2. Fetch Users
      const { data: userData } = await supabase.from('users').select('full_name, email, role, prakalpa_name').eq('status', 'Active');
      if (userData) setUsers(userData);

      // 3. Fetch Master Audit Areas
      const { data: areaData } = await supabase.from('master_dropdowns').select('value, parent_value').eq('category', 'Audit Area').eq('status', 'Active');
      if (areaData) setMasterAuditAreas(areaData);

      // 4. Fetch Plans
      let query = supabase.from('audit_plan').select('*');
      if (ayFilter) query = query.eq('ay_year', ayFilter);
      
      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const processed = data.map((p) => ({
          ...p,
          audit_id: p.audit_id || "",
          prakalpa_name: p.prakalpa_name || "Unknown",
          coordinator_name: p.coordinator_name || "Unassigned",
          status: p.status || "Planned",
          dateObj: p.planned_date ? new Date(p.planned_date) : null,
        }));
        processed.sort((a, b) => b.audit_id.localeCompare(a.audit_id));
        setPlans(processed);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [ayFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete Audit ${id}?`)) return;
    const { error } = await supabase.from('audit_plan').delete().eq('audit_id', id);
    if (!error) { alert("Deleted"); setPlans(p => p.filter(x => x.audit_id !== id)); }
  };

  const openScheduleModal = (item) => {
    setEditData(item);
    setEditForm({
        schedule_start_date: toInputDate(item.schedule_start_date || item.planned_date),
        schedule_end_date: toInputDate(item.schedule_end_date || item.planned_date),
        schedule_time: item.schedule_time || "",
        prakalpa_name: item.prakalpa_name || "", 
        functional_area: item.functional_area || "",
        coordinator_name: item.coordinator_name || "",
        selected_audit_areas: item.audit_areas ? item.audit_areas.split(',').map(s=>s.trim()) : [],
        assigned_auditors: item.assigned_auditors || "", 
        assigned_auditees: item.assigned_auditees ? item.assigned_auditees.split(',').map(s=>s.trim()) : [],
        status: 'Scheduled' 
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    const payload = {
        schedule_start_date: editForm.schedule_start_date || null,
        schedule_end_date: editForm.schedule_end_date || null,
        schedule_time: editForm.schedule_time,
        functional_area: editForm.functional_area,
        audit_areas: editForm.selected_audit_areas.join(', '),
        assigned_auditors: editForm.assigned_auditors, 
        assigned_auditees: editForm.assigned_auditees.join(', '),
        status: 'Scheduled'
    };

    try {
        const { error } = await supabase.from('audit_plan').update(payload).eq('audit_id', editData.audit_id);
        if (error) throw error;
        alert("Audit Scheduled Successfully!");
        setEditData(null);
        fetchData();
    } catch (error) {
        alert("Error saving: " + error.message);
    } finally {
        setSubmitting(false);
    }
  };

  const toggleList = (listKey, value) => {
    setEditForm(prev => {
        const list = prev[listKey] || [];
        if (list.includes(value)) return { ...prev, [listKey]: list.filter(i => i !== value) };
        return { ...prev, [listKey]: [...list, value] };
    });
  };

  // --- FILTER HELPERS ---
  const getRelevantAuditAreas = () => {
    const parentArea = normalize(editForm.functional_area);
    return masterAuditAreas.filter(item => normalize(item.parent_value) === parentArea);
  };

  // 🟢 UPDATED: Allow Coordinators to be Auditees too
  const getAuditeeOptions = () => users.filter(u => {
     const r = normalize(u.role);
     
     // 1. Check Role: Must be Auditee OR Audit Coordinator
     const isEligible = r.includes('auditee') || r.includes('coordinator');
     
     // 2. Check Location: Must match the Audit Plan's location
     const isLocationMatch = normalize(u.prakalpa_name) === normalize(editData?.prakalpa_name);
     
     return isEligible && isLocationMatch;
  }).sort((a,b) => (a.full_name || "").localeCompare(b.full_name || ""));

  // --- SORTING & RENDERING ---
  const uniqueStatuses = useMemo(() => [...new Set(plans.map(p => p.status).filter(Boolean))].sort(), [plans]);
  const uniqueCoordinators = useMemo(() => [...new Set(plans.map(p => p.coordinator_name).filter(Boolean))].sort(), [plans]);

  const filteredPlans = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return plans.filter(p => {
        const matchesSearch = !term || p.audit_id.toLowerCase().includes(term) || p.prakalpa_name.toLowerCase().includes(term) || p.functional_area.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || p.status === statusFilter;
        const matchesCoord = !coordinatorFilter || p.coordinator_name === coordinatorFilter;
        let matchesDate = true;
        if (startDate && p.dateObj) matchesDate = matchesDate && p.dateObj >= new Date(startDate);
        if (endDate && p.dateObj) { const end = new Date(endDate); end.setHours(23,59,59); matchesDate = matchesDate && p.dateObj <= end; }
        return matchesSearch && matchesStatus && matchesCoord && matchesDate;
    });
  }, [plans, searchTerm, statusFilter, coordinatorFilter, startDate, endDate]);

  const sortedPlans = useMemo(() => {
    const items = [...filteredPlans];
    const { key, direction } = sortConfig;
    const dir = direction === "ascending" ? 1 : -1;
    items.sort((a, b) => (a[key] ?? "").toString().localeCompare((b[key] ?? "").toString()) * dir);
    return items;
  }, [filteredPlans, sortConfig]);

  const currentItems = sortedPlans.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  const requestSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "ascending" ? "descending" : "ascending" }));
  const SortIcon = ({ col }) => sortConfig.key !== col ? <ArrowUpDown size={14} className="text-gray-300"/> : sortConfig.direction === "ascending" ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>;

  const handleExport = () => {
    if (filteredPlans.length === 0) return alert("No data");
    const headers = ["ID", "AY", "Prakalpa", "Area", "Coordinator", "Planned Date", "Status"];
    const rows = filteredPlans.map(r => [csvEscape(r.audit_id), csvEscape(r.ay_year), csvEscape(r.prakalpa_name), csvEscape(r.functional_area), csvEscape(r.coordinator_name), csvEscape(formatDate(r.planned_date)), csvEscape(r.status)]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
    link.download = `Audit_Plans_${ayFilter}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-blue-600" /> Audit Planning</h1>
            <p className="text-sm text-gray-500 mt-1">Plan and Schedule audits for AY {ayFilter}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExport} className="bg-white border p-2 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-2 px-3 text-sm font-medium"><Download size={18} /> CSV</button>
            <button onClick={fetchData} className="bg-white border p-2 rounded-lg hover:bg-gray-50"><RefreshCw size={20} /></button>
            <button onClick={() => navigate("/planning/new")} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> Create Plan</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col xl:flex-row gap-4">
           <div className="relative w-full xl:w-40">
             <Archive className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg font-bold text-blue-800 bg-blue-50 outline-none cursor-pointer" 
                value={ayFilter} onChange={e => setAyFilter(e.target.value)}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
           </div>
           <div className="relative flex-1">
             <Search className="absolute left-3 top-3 text-gray-400" size={18} />
             <input type="text" placeholder="Search ID, Prakalpa, Area..." className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-100" 
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <div className="relative w-full xl:w-40">
             <Filter className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           <div className="relative w-full xl:w-48">
             <User className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none" value={coordinatorFilter} onChange={e => setCoordinatorFilter(e.target.value)}>
                <option value="">All Coordinators</option>
                {uniqueCoordinators.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
           {(searchTerm || statusFilter || coordinatorFilter) && (
             <button onClick={() => {setSearchTerm(""); setStatusFilter(""); setCoordinatorFilter("");}} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold"><X size={18}/></button>
           )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th onClick={() => requestSort("audit_id")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">ID <SortIcon col="audit_id"/></div></th>
                <th onClick={() => requestSort("prakalpa_name")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Prakalpa <SortIcon col="prakalpa_name"/></div></th>
                <th onClick={() => requestSort("functional_area")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Functional Area <SortIcon col="functional_area"/></div></th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500">Coordinator</th>
                <th onClick={() => requestSort("planned_date")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Planned Date <SortIcon col="planned_date"/></div></th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan="7" className="p-12 text-center text-gray-500 animate-pulse">Loading...</td></tr>}
              {!loading && currentItems.length === 0 && <tr><td colSpan="7" className="p-12 text-center text-gray-400">No audits found.</td></tr>}

              {currentItems.map((plan) => (
                <tr key={plan.audit_id} className="hover:bg-blue-50/50 transition">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">{plan.audit_id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{plan.prakalpa_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{plan.functional_area}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{plan.coordinator_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(plan.planned_date)}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>{plan.status}</span></td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => openScheduleModal(plan)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-blue-100" title="Schedule Audit">
                        <CalendarClock size={16} />
                    </button>
                    <button onClick={() => setViewData(plan)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded border border-gray-100" title="View">
                        <Eye size={16} />
                    </button>
                    <button onClick={() => handleDelete(plan.audit_id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded border border-red-100" title="Delete">
                        <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between px-6 py-4 border-t">
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 border rounded disabled:opacity-50"><ChevronLeft size={16}/></button>
            <span className="text-sm text-gray-500">Page {currentPage}</span>
            <button onClick={() => setCurrentPage(p => p+1)} disabled={currentItems.length < itemsPerPage} className="px-3 py-1 border rounded disabled:opacity-50"><ChevronRight size={16}/></button>
        </div>
      </div>

      {/* 🟢 SCHEDULING / EDIT MODAL */}
      {editData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
              <div className="bg-blue-600 px-6 py-4 border-b flex justify-between items-center text-white">
                 <h3 className="text-lg font-bold flex items-center gap-2"><CalendarClock/> Schedule Audit</h3>
                 <button onClick={() => setEditData(null)}><X size={20} className="hover:text-blue-200"/></button>
              </div>
              
              <form onSubmit={handleSaveSchedule} className="p-6 space-y-5">
                 <div className="bg-blue-50 p-3 rounded text-sm text-blue-900 border border-blue-100 flex justify-between">
                    <span><strong>{editData.audit_id}</strong></span>
                    <span>AY {ayFilter}</span>
                 </div>

                 {/* 🟢 NEW FIELD: PRAKALPA (Read Only) */}
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prakalpa</label>
                    <input className="w-full border rounded p-2 text-sm bg-gray-50 font-bold text-gray-700" readOnly 
                        value={editForm.prakalpa_name} />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                       <input type="date" required className="w-full border rounded p-2 text-sm" 
                          value={editForm.schedule_start_date} onChange={e=>setEditForm({...editForm, schedule_start_date: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                       <input type="date" required className="w-full border rounded p-2 text-sm" 
                          value={editForm.schedule_end_date} onChange={e=>setEditForm({...editForm, schedule_end_date: e.target.value})} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Time (e.g. 10 AM - 2 PM)</label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input type="text" className="w-full border rounded pl-10 pr-3 py-2 text-sm" placeholder="Enter time range"
                            value={editForm.schedule_time} onChange={e=>setEditForm({...editForm, schedule_time: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Functional Area</label>
                        <input className="w-full border rounded p-2 text-sm bg-gray-50" readOnly 
                            value={editForm.functional_area} />
                    </div>
                    
                    {/* 🟢 READ-ONLY COORDINATOR */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Audit Coordinator</label>
                        <input className="w-full border rounded p-2 text-sm bg-gray-50" readOnly 
                            value={editForm.coordinator_name} />
                    </div>
                 </div>

                 {/* Audit Areas */}
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Audit Areas (Scope)</label>
                    <div className="border rounded p-2 max-h-32 overflow-y-auto bg-white space-y-1">
                        {getRelevantAuditAreas().length === 0 && <p className="text-xs text-gray-400">No areas found for {editForm.functional_area}</p>}
                        {getRelevantAuditAreas().map((item, i) => (
                            <div key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" 
                                 onClick={() => toggleList('selected_audit_areas', item.value)}>
                                {editForm.selected_audit_areas.includes(item.value) ? <CheckSquare size={14} className="text-green-600"/> : <Square size={14} className="text-gray-400"/>}
                                <span className="text-xs text-gray-700">{item.value}</span>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* 🟢 MANUAL AUDITOR ENTRY */}
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditors (Names)</label>
                    <textarea 
                        className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        rows="2"
                        placeholder="Enter auditor names separated by comma (e.g. John Doe, Jane Smith)"
                        value={editForm.assigned_auditors}
                        onChange={(e) => setEditForm({...editForm, assigned_auditors: e.target.value})}
                    ></textarea>
                 </div>

                 {/* 🟢 STRICT AUDITEE FILTER */}
                 <div className="border rounded p-3">
                    <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditees (Only from {editData.prakalpa_name})</label>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                        {getAuditeeOptions().length === 0 && <p className="text-xs text-red-400">No auditees found in this location.</p>}
                        {getAuditeeOptions().map((u,i) => (
                            <div key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleList('assigned_auditees', u.full_name)}>
                                {editForm.assigned_auditees.includes(u.full_name) ? <CheckSquare size={16} className="text-orange-600"/> : <Square size={16} className="text-gray-400"/>}
                                <span className="text-sm text-gray-700">{u.full_name}</span>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* 🟢 READ-ONLY STATUS */}
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
                    <input className="w-full border rounded p-2 text-sm bg-gray-100 text-gray-500" readOnly 
                        value={editForm.status} />
                 </div>

                 <div className="flex justify-end gap-2 pt-2 border-t">
                    <button type="button" onClick={()=>setEditData(null)} className="px-4 py-2 border rounded text-sm font-bold text-gray-600">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold flex items-center gap-2">
                        {submitting ? "Saving..." : <><Save size={16}/> Save Schedule</>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 🟢 VIEW MODAL (Read Only) */}
      {viewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="font-bold text-lg text-gray-800">Audit Details</h3>
                <button onClick={() => setViewData(null)}><X size={20} className="text-gray-400"/></button>
             </div>
             <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div><span className="block text-xs font-bold text-gray-400">ID</span> <span className="font-mono text-blue-600 font-bold">{viewData.audit_id}</span></div>
                    <div><span className="block text-xs font-bold text-gray-400">Status</span> <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(viewData.status)}`}>{viewData.status}</span></div>
                </div>
                <div><span className="block text-xs font-bold text-gray-400">Prakalpa</span> <span className="font-medium">{viewData.prakalpa_name}</span></div>
                <div><span className="block text-xs font-bold text-gray-400">Functional Area</span> <span className="font-medium">{viewData.functional_area}</span></div>
                <div><span className="block text-xs font-bold text-gray-400">Coordinator</span> <span>{viewData.coordinator_name}</span></div>
                
                {viewData.schedule_start_date && (
                    <div className="bg-gray-50 p-3 rounded border mt-2">
                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><CalendarClock size={14}/> Schedule</h4>
                        <div className="grid grid-cols-2 gap-y-2">
                            <p><strong>Start:</strong> {formatDate(viewData.schedule_start_date)}</p>
                            <p><strong>End:</strong> {formatDate(viewData.schedule_end_date)}</p>
                            <p className="col-span-2"><strong>Time:</strong> {viewData.schedule_time || '-'}</p>
                            <p className="col-span-2"><strong>Audit Areas:</strong> {viewData.audit_areas || '-'}</p>
                            <p className="col-span-2"><strong>Auditors:</strong> {viewData.assigned_auditors || '-'}</p>
                            <p className="col-span-2"><strong>Auditees:</strong> {viewData.assigned_auditees || '-'}</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlannedAudits;