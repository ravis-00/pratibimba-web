import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Search, RefreshCw, Calendar, MapPin, User, Trash2, Edit,
  CalendarClock, Filter, X, ChevronLeft, ChevronRight,
  Download, ArrowUpDown, ArrowUp, ArrowDown, Eye, Save, Archive, CheckSquare, Square, Clock, ListFilter, FileText, CheckCircle, PieChart, AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

// Internal Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-2 animate-fade-in`}>
      {type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
      <span className="font-bold">{type === 'success' ? 'Success' : 'Error'}:</span> {message}
    </div>
  );
};

const PlannedAudits = () => {
  const navigate = useNavigate();

  // GET CURRENT USER
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  // CALCULATE CURRENT AY
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
  
  // State for Dropdowns
  const [prakalpas, setPrakalpas] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [showPlannedOnly, setShowPlannedOnly] = useState(true);

  // Filters & Pagination
  const [ayFilter, setAyFilter] = useState(getCurrentAY());
  const [availableYears, setAvailableYears] = useState([getCurrentAY()]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "audit_id", direction: "descending" });

  // Modals
  const [viewData, setViewData] = useState(null);
  const [editData, setEditData] = useState(null); // For SCHEDULING
  const [reportData, setReportData] = useState(null); 
  const [loadingReport, setLoadingReport] = useState(false);

  // Edit Plan Modal State
  const [editPlanData, setEditPlanData] = useState(null);
  const [planForm, setPlanForm] = useState({
      prakalpa_name: "",
      functional_area: "",
      coordinator_name: "",
      planned_date: ""
  });

  // Schedule Form State
  const [editForm, setEditForm] = useState({
    schedule_start_date: "",
    schedule_end_date: "",
    schedule_time: "9:30 to 5:30",
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
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

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
  
  // 🟢 FIX: Improved Normalization for Matching
  const normalize = (str) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');

  // Report Logic Helpers
  const getReportRef = (auditId) => (auditId || "REF").replace("IQA", "IAR");

  const getCounts = (obsList) => {
      if(!obsList) return { nc: 0, ofi: 0, gp: 0 };
      let nc = 0, ofi = 0, gp = 0;
      obsList.forEach(o => {
          const t = (o.type || "").toLowerCase();
          if(t.includes('non') || t.includes('nc')) nc++;
          else if(t.includes('improvement') || t.includes('opportunity') || t.includes('ofi')) ofi++;
          else if(t.includes('good') || t.includes('compliant') || t.includes('best')) gp++;
      });
      return { nc, ofi, gp };
  };

  const processObservations = (obsList, auditId) => {
    if (!obsList) return [];
    const reportRef = (auditId || "REF").replace("IQA", "IAR");
    let trackingSeq = 0;
    let gpSeq = 0;

    return obsList.map(obs => {
        const t = (obs.type || "").toLowerCase();
        let displayId = "";
        let badgeClass = "bg-gray-100 text-gray-800";

        const isNC = t.includes('non') || t.includes('nc');
        const isOFI = t.includes('improvement') || t.includes('opportunity') || t.includes('ofi');
        
        if (isNC || isOFI) {
            trackingSeq++;
            displayId = `${reportRef}-${String(trackingSeq).padStart(2, '0')}`;
            if(isNC) badgeClass = "bg-red-100 text-red-800";
            if(isOFI) badgeClass = "bg-blue-100 text-blue-800";
        } else {
            gpSeq++;
            displayId = `GP-${String(gpSeq).padStart(2, '0')}`;
            badgeClass = "bg-green-100 text-green-800";
        }
        return { ...obs, displayId, badgeClass };
    });
  };

  // =========================
  // 3. API ACTIONS
  // =========================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Years
      const { data: yearData } = await supabase.from('audit_plan').select('ay_year');
      if (yearData) {
        const years = [...new Set(yearData.map(y => y.ay_year).filter(Boolean))].sort().reverse();
        if (years.length > 0) setAvailableYears(years);
      }

      // 🟢 FIX: Ensure Users are fetched with Location
      const { data: userData } = await supabase.from('users').select('full_name, email, role, prakalpa_name').eq('status', 'Active');
      if (userData) setUsers(userData);

      // Fetch Master Data
      const { data: areaData } = await supabase.from('master_dropdowns').select('value, parent_value, category').eq('status', 'Active');
      if (areaData) {
          setMasterAuditAreas(areaData.filter(d => d.category === 'Audit Area'));
          setFunctionalAreas(areaData.filter(d => d.category === 'Functional Area'));
      }

      const { data: prakalpaData } = await supabase.from('master_prakalpas').select('prakalpa_name').order('prakalpa_name');
      if (prakalpaData) setPrakalpas(prakalpaData);

      // Fetch Plans
      let query = supabase.from('audit_plan').select('*');
      
      if (!isAdmin) {
          const myName = currentUser.full_name || 'Unknown';
          const myLoc = currentUser.prakalpa_name || 'Unknown';
          query = query.or(`coordinator_name.eq.${myName},prakalpa_name.eq.${myLoc}`);
      }

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
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [ayFilter, isAdmin, currentUser.full_name, currentUser.prakalpa_name]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!isAdmin) return showToast("Permission Denied: Only Admins can delete.", "error");
    if (!window.confirm(`Delete Audit ${id}?`)) return;
    
    const { error } = await supabase.from('audit_plan').delete().eq('audit_id', id);
    if (!error) { 
        showToast("Audit Plan deleted successfully", "success"); 
        setPlans(p => p.filter(x => x.audit_id !== id)); 
    } else {
        showToast("Delete failed: " + error.message, "error");
    }
  };

  const handleOpenReport = async (plan) => {
      setReportData(null);
      setLoadingReport(true);
      try {
          const { data: findings, error } = await supabase
              .from('audit_observations')
              .select('*')
              .eq('audit_id', plan.audit_id);
          
          if(error) throw error;

          setReportData({
              ...plan,
              observations: findings || []
          });
      } catch (e) {
          showToast("Error loading report: " + e.message, "error");
      } finally {
          setLoadingReport(false);
      }
  };

  // --- SCHEDULING LOGIC (Fixed for "null" values) ---
  const openScheduleModal = (item) => {
    setEditData(item);
    
    // 🟢 FIX: Handle "null" strings stored in DB
    const safeAuditors = (item.assigned_auditors && String(item.assigned_auditors).toLowerCase() !== 'null') 
        ? item.assigned_auditors 
        : "";
    
    const safeAuditees = (item.assigned_auditees && String(item.assigned_auditees).toLowerCase() !== 'null') 
        ? item.assigned_auditees.split(',').map(s=>s.trim()) 
        : [];

    setEditForm({
        schedule_start_date: toInputDate(item.schedule_start_date || item.planned_date),
        schedule_end_date: toInputDate(item.schedule_end_date || item.planned_date),
        schedule_time: item.schedule_time || "9:30 to 5:30",
        prakalpa_name: item.prakalpa_name || "", 
        functional_area: item.functional_area || "",
        coordinator_name: item.coordinator_name || "",
        selected_audit_areas: item.audit_areas ? item.audit_areas.split(',').map(s=>s.trim()) : [],
        assigned_auditors: safeAuditors, 
        assigned_auditees: safeAuditees,
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
        showToast("Audit Scheduled Successfully!", "success");
        setEditData(null);
        fetchData();
    } catch (error) {
        showToast("Error saving: " + error.message, "error");
    } finally {
        setSubmitting(false);
    }
  };

  // --- EDIT PLAN LOGIC ---
  const openEditPlanModal = (item) => {
      setEditPlanData(item);
      setPlanForm({
          prakalpa_name: item.prakalpa_name,
          functional_area: item.functional_area,
          coordinator_name: item.coordinator_name,
          planned_date: toInputDate(item.planned_date)
      });
  };

  const handleUpdatePlan = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
          const { error } = await supabase.from('audit_plan').update({
              prakalpa_name: planForm.prakalpa_name,
              functional_area: planForm.functional_area,
              coordinator_name: planForm.coordinator_name,
              planned_date: planForm.planned_date
          }).eq('audit_id', editPlanData.audit_id);

          if (error) throw error;
          showToast("Audit Plan Updated Successfully!", "success");
          setEditPlanData(null);
          fetchData();
      } catch (error) {
          showToast("Update failed: " + error.message, "error");
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

  const getAuditeeOptions = () => {
      // 🟢 FIX: Robust Location Matching
      const targetLocation = normalize(editForm.prakalpa_name);

      return users.filter(u => {
          const r = normalize(u.role);
          const isEligible = r.includes('auditee') || r.includes('coordinator');
          
          // Match logic: Exact match OR contains (handles "Yoga Kendra" vs "Yoga Kendra ")
          const userLocation = normalize(u.prakalpa_name);
          const isLocationMatch = userLocation === targetLocation || (targetLocation && userLocation.includes(targetLocation));

          return isEligible && isLocationMatch;
      }).sort((a,b) => (a.full_name || "").localeCompare(b.full_name || ""));
  };

  const getCoordinatorsList = () => users.filter(u => normalize(u.role).includes('coordinator'));

  // --- SORTING & RENDERING ---
  const uniqueStatuses = useMemo(() => [...new Set(plans.map(p => p.status).filter(Boolean))].sort(), [plans]);
  const uniqueCoordinators = useMemo(() => [...new Set(plans.map(p => p.coordinator_name).filter(Boolean))].sort(), [plans]);

  const statusCounts = useMemo(() => {
      const counts = { planned: 0, scheduled: 0, completed: 0 };
      plans.forEach(p => {
          if (p.status === 'Planned') counts.planned++;
          else if (p.status === 'Scheduled') counts.scheduled++;
          else if (p.status === 'Completed') counts.completed++;
      });
      return counts;
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    let baseList = plans;
    if (showPlannedOnly) {
        baseList = baseList.filter(p => p.status === 'Planned');
    }

    return baseList.filter(p => {
        const matchesSearch = !term || p.audit_id.toLowerCase().includes(term) || p.prakalpa_name.toLowerCase().includes(term) || p.functional_area.toLowerCase().includes(term);
        const matchesStatus = !statusFilter || p.status === statusFilter;
        const matchesCoord = !coordinatorFilter || p.coordinator_name === coordinatorFilter;
        return matchesSearch && matchesStatus && matchesCoord;
    });
  }, [plans, showPlannedOnly, searchTerm, statusFilter, coordinatorFilter]);

  const sortedPlans = useMemo(() => {
    const items = [...filteredPlans];
    const { key, direction } = sortConfig;
    const dir = direction === "ascending" ? 1 : -1;
    items.sort((a, b) => (a[key] ?? "").toString().localeCompare((b[key] ?? "").toString()) * dir);
    return items;
  }, [filteredPlans, sortConfig]);

  // Pagination
  const totalItems = sortedPlans.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedPlans.slice(indexOfFirstItem, indexOfLastItem);
  const startRecord = totalItems === 0 ? 0 : indexOfFirstItem + 1;
  const endRecord = Math.min(indexOfLastItem, totalItems);

  const requestSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "ascending" ? "descending" : "ascending" }));
  const SortIcon = ({ col }) => sortConfig.key !== col ? <ArrowUpDown size={14} className="text-gray-300"/> : sortConfig.direction === "ascending" ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>;

  // HANDLERS
  const handleStatusChange = (val) => {
      setStatusFilter(val);
      setCurrentPage(1); 
      if (val && val !== 'Planned') setShowPlannedOnly(false);
  };

  const handleCoordinatorChange = (val) => {
      setCoordinatorFilter(val);
      setCurrentPage(1); 
  };

  const handleSearchChange = (val) => {
      setSearchTerm(val);
      setCurrentPage(1);
  };

  const clearFilters = () => {
      setSearchTerm("");
      setStatusFilter("");
      setCoordinatorFilter("");
      setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredPlans.length === 0) return showToast("No data to export", "error");
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
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-blue-600" /> Audit Planning</h1>
            <p className="text-sm text-gray-500 mt-1">
                {isAdmin ? "Manage the entire organization's audit calendar." : `Viewing audit plan for ${currentUser.full_name}`}
            </p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExport} className="bg-white border p-2 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-2 px-3 text-sm font-medium"><Download size={18} /> CSV</button>
            <button onClick={fetchData} className="bg-white border p-2 rounded-lg hover:bg-gray-50"><RefreshCw size={20} /></button>
            {isAdmin && (
                <button onClick={() => navigate("/planning/new")} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> Create Plan</button>
            )}
        </div>
      </div>

      {/* STATUS SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div><p className="text-xs text-gray-500 uppercase font-bold">Total Assigned</p><p className="text-xl font-bold text-gray-800">{plans.length}</p></div>
              <div className="bg-gray-100 p-2 rounded-full text-gray-600"><PieChart size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 flex items-center justify-between">
              <div><p className="text-xs text-yellow-600 uppercase font-bold">Planned</p><p className="text-xl font-bold text-yellow-700">{statusCounts.planned}</p></div>
              <div className="bg-yellow-50 p-2 rounded-full text-yellow-600"><Clock size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex items-center justify-between">
              <div><p className="text-xs text-blue-600 uppercase font-bold">Scheduled</p><p className="text-xl font-bold text-blue-700">{statusCounts.scheduled}</p></div>
              <div className="bg-blue-50 p-2 rounded-full text-blue-600"><CalendarClock size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100 flex items-center justify-between">
              <div><p className="text-xs text-purple-600 uppercase font-bold">Completed</p><p className="text-xl font-bold text-purple-700">{statusCounts.completed}</p></div>
              <div className="bg-purple-50 p-2 rounded-full text-purple-600"><CheckCircle size={20}/></div>
          </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
            <div className="flex items-center gap-3">
                <button onClick={() => { setShowPlannedOnly(true); setCurrentPage(1); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition ${showPlannedOnly ? 'bg-yellow-100 text-yellow-800 border-yellow-200 border' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <ListFilter size={16}/> Planning Queue
                </button>
                <button onClick={() => { setShowPlannedOnly(false); setCurrentPage(1); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition ${!showPlannedOnly ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <CalendarClock size={16}/> All Audits
                </button>
            </div>
            <div className="text-xs text-gray-400">
                Viewing: <strong>{showPlannedOnly ? "Pending Plans Only" : "Full History"}</strong>
            </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
           <div className="relative w-full xl:w-40">
             <Archive className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg font-bold text-blue-800 bg-blue-50 outline-none cursor-pointer" 
               value={ayFilter} onChange={e => { setAyFilter(e.target.value); setCurrentPage(1); }}>
               {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
           </div>
           
           <div className="relative flex-1">
             <Search className="absolute left-3 top-3 text-gray-400" size={18} />
             <input type="text" placeholder="Search ID, Prakalpa, Area..." className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-100" 
               value={searchTerm} onChange={e => handleSearchChange(e.target.value)} />
           </div>
           
           <div className="relative w-full xl:w-40">
             <Filter className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none" value={statusFilter} onChange={e => handleStatusChange(e.target.value)}>
                <option value="">All Statuses</option>
                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           
           {isAdmin && (
               <div className="relative w-full xl:w-48">
                 <User className="absolute left-3 top-3 text-gray-400" size={16} />
                 <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg outline-none" value={coordinatorFilter} onChange={e => handleCoordinatorChange(e.target.value)}>
                    <option value="">All Coordinators</option>
                    {uniqueCoordinators.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
           )}
           
           {(searchTerm || statusFilter || coordinatorFilter) && (
             <button onClick={clearFilters} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold flex items-center gap-2">
                <X size={18}/> Clear
             </button>
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
                    {plan.status === 'Completed' ? (
                        <button onClick={() => handleOpenReport(plan)} className="text-purple-600 hover:bg-purple-50 p-1.5 rounded border border-purple-100" title="View Audit Report">
                            <FileText size={16} />
                        </button>
                    ) : (
                        <>
                            {isAdmin && plan.status === 'Planned' && (
                                <button onClick={() => openEditPlanModal(plan)} className="text-orange-500 hover:bg-orange-50 p-1.5 rounded border border-orange-100" title="Edit Plan Details">
                                    <Edit size={16} />
                                </button>
                            )}

                            {(isAdmin || plan.coordinator_name === currentUser.full_name) && plan.status === 'Planned' && (
                                <button onClick={() => openScheduleModal(plan)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-blue-100" title="Schedule Audit">
                                    <CalendarClock size={16} />
                                </button>
                            )}
                            
                            <button onClick={() => setViewData(plan)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded border border-gray-100" title="View Details">
                                <Eye size={16} />
                            </button>
                            {isAdmin && (
                                <button onClick={() => handleDelete(plan.audit_id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded border border-red-100" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredPlans.length > 0 && (
            <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t bg-gray-50">
                <span className="text-sm text-gray-600 mb-2 md:mb-0">
                    Showing <strong>{startRecord}-{endRecord}</strong> of <strong>{filteredPlans.length}</strong> Records
                </span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="p-2 border rounded-lg bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="p-2 border rounded-lg bg-white disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={16}/></button>
                </div>
            </div>
        )}
      </div>

      {/* EDIT PLAN DETAILS MODAL */}
      {editPlanData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="bg-orange-600 px-6 py-4 border-b flex justify-between items-center text-white rounded-t-xl">
                 <h3 className="text-lg font-bold flex items-center gap-2"><Edit/> Edit Audit Plan</h3>
                 <button onClick={() => setEditPlanData(null)}><X size={20} className="hover:text-orange-200"/></button>
              </div>
              
              <form onSubmit={handleUpdatePlan} className="p-6 space-y-5">
                 <div className="bg-orange-50 p-3 rounded text-sm text-orange-900 border border-orange-100 font-mono font-bold text-center">
                    Editing Plan: {editPlanData.audit_id}
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prakalpa (Location)</label>
                    <select required className="w-full border rounded p-2.5 bg-white" 
                        value={planForm.prakalpa_name} onChange={e => setPlanForm({...planForm, prakalpa_name: e.target.value})}>
                        {prakalpas.map((p, i) => <option key={i} value={p.prakalpa_name}>{p.prakalpa_name}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Functional Area</label>
                    <select required className="w-full border rounded p-2.5 bg-white" 
                        value={planForm.functional_area} onChange={e => setPlanForm({...planForm, functional_area: e.target.value})}>
                        {functionalAreas.map((f, i) => <option key={i} value={f.value}>{f.value}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Coordinator</label>
                    <select required className="w-full border rounded p-2.5 bg-white" 
                        value={planForm.coordinator_name} onChange={e => setPlanForm({...planForm, coordinator_name: e.target.value})}>
                        <option value="">Select Coordinator</option>
                        {getCoordinatorsList().map((c, i) => <option key={i} value={c.full_name}>{c.full_name}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Planned Date</label>
                    <input required type="date" className="w-full border rounded p-2.5" 
                        value={planForm.planned_date} onChange={e => setPlanForm({...planForm, planned_date: e.target.value})} />
                 </div>

                 <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={()=>setEditPlanData(null)} className="px-4 py-2 border rounded text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-bold flex items-center gap-2 hover:bg-orange-700">
                        {submitting ? "Saving..." : <><Save size={16}/> Update Plan</>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* SCHEDULING MODAL */}
      {editData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="bg-blue-600 px-6 py-4 border-b flex justify-between items-center text-white">
                 <h3 className="text-lg font-bold flex items-center gap-2"><CalendarClock/> Schedule Audit</h3>
                 <button onClick={() => setEditData(null)}><X size={20} className="hover:text-blue-200"/></button>
              </div>
              
              <form onSubmit={handleSaveSchedule} className="p-6 space-y-5">
                 <div className="bg-blue-50 p-3 rounded text-sm text-blue-900 border border-blue-100 flex justify-between">
                    <span><strong>{editData.audit_id}</strong></span>
                    <span>AY {ayFilter}</span>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prakalpa (Location)</label>
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
                    <label className="block text-xs font-bold text-gray-500 mb-1">Time Slot & Agenda</label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <select 
                            className="w-full border rounded pl-10 pr-3 py-2 text-sm bg-white"
                            value={editForm.schedule_time}
                            onChange={(e) => setEditForm({...editForm, schedule_time: e.target.value})}
                        >
                            <option value="9:30 to 5:30">Full Day (9:30 AM - 5:30 PM)</option>
                            <option value="9:30 to 1:30">Morning Half (9:30 AM - 1:30 PM)</option>
                            <option value="2:00 to 5:30">Afternoon Half (2:00 PM - 5:30 PM)</option>
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Functional Area</label>
                        <input className="w-full border rounded p-2 text-sm bg-gray-50" readOnly 
                           value={editForm.functional_area} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Audit Coordinator</label>
                        <input className="w-full border rounded p-2 text-sm bg-gray-50" readOnly 
                           value={editForm.coordinator_name} />
                    </div>
                 </div>

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

                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditors (Names)</label>
                    <textarea 
                        className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        rows="2"
                        placeholder="Enter auditor names separated by comma"
                        value={editForm.assigned_auditors}
                        onChange={(e) => setEditForm({...editForm, assigned_auditors: e.target.value})}
                    ></textarea>
                 </div>

                 <div className="border rounded p-3">
                    <label className="block text-xs font-bold text-gray-500 mb-2">Assign Auditees (Only from {editData.prakalpa_name})</label>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                        {/* 🟢 NEW: Helpful "No Users" Message */}
                        {getAuditeeOptions().length === 0 && (
                            <p className="text-xs text-red-400 p-2">
                                No users found for <strong>{editForm.prakalpa_name}</strong>. 
                                <br/>Check "User Management" to ensure users are assigned to this location.
                            </p>
                        )}

                        {getAuditeeOptions().map((u,i) => (
                            <div key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => toggleList('assigned_auditees', u.full_name)}>
                                {editForm.assigned_auditees.includes(u.full_name) ? <CheckSquare size={16} className="text-orange-600"/> : <Square size={16} className="text-gray-400"/>}
                                <span className="text-sm text-gray-700">{u.full_name}</span>
                            </div>
                        ))}
                    </div>
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

      {/* VIEW DETAILS MODAL */}
      {viewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
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
             </div>
          </div>
        </div>
      )}

      {/* REPORT VIEWER MODAL */}
      {reportData && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto backdrop-blur-sm flex justify-center items-start pt-10 pb-10">
          <div className="bg-white w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden">
            
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="font-bold text-lg">Completed Audit Report</h2>
                <button onClick={() => setReportData(null)} className="text-gray-400 hover:text-white transition">
                    <X size={24}/>
                </button>
            </div>

            <div className="p-10 min-h-[500px]">
                {loadingReport ? (
                    <div className="text-center p-10 text-gray-500">Loading Report...</div>
                ) : (
                    <div className="space-y-8">
                        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wide">Internal Quality Audit Report</h1>
                                <p className="text-gray-500 mt-1">Rashtrotthana Parishat • 2025-26</p>
                                <p className="text-sm font-mono text-gray-600 mt-1">
                                    Report Ref: <strong>{getReportRef(reportData.audit_id)}</strong>
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-mono font-bold text-gray-600">{reportData.audit_id}</div>
                                <div className="text-sm text-green-600 font-bold uppercase border border-green-600 px-2 py-0.5 rounded inline-block mt-1">
                                    COMPLETED
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 bg-gray-50 p-6 rounded-lg">
                            <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Location</h3><p className="text-lg font-bold text-gray-800">{reportData.prakalpa_name}</p></div>
                            <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Functional Area</h3><p className="text-lg font-bold text-gray-800">{reportData.functional_area}</p></div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Audit Team</h3>
                                <p className="text-sm text-gray-700"><strong>Coordinator:</strong> {reportData.coordinator_name || 'N/A'}</p>
                                <p className="text-sm text-gray-700"><strong>Auditors:</strong> {reportData.assigned_auditors || 'N/A'}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Timeline</h3>
                                <p className="text-sm text-gray-700"><strong>Scheduled:</strong> {formatDate(reportData.schedule_start_date)}</p>
                                <p className="text-sm text-gray-700"><strong>Completed:</strong> {formatDate(reportData.completion_date || reportData.schedule_end_date)}</p>
                            </div>
                        </div>

                        <div>
                             <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Executive Summary</h3>
                             {(() => {
                                 const counts = getCounts(reportData.observations);
                                 return (
                                     <div className="flex gap-4">
                                         <div className="flex-1 bg-red-50 border border-red-100 p-4 rounded text-center">
                                             <div className="text-3xl font-bold text-red-600">{counts.nc}</div>
                                             <div className="text-xs text-red-800 font-bold uppercase">Non-Conformances</div>
                                         </div>
                                         <div className="flex-1 bg-blue-50 border border-blue-100 p-4 rounded text-center">
                                             <div className="text-3xl font-bold text-blue-600">{counts.ofi}</div>
                                             <div className="text-xs text-blue-800 font-bold uppercase">Opportunities (OFI)</div>
                                         </div>
                                         <div className="flex-1 bg-green-50 border border-green-100 p-4 rounded text-center">
                                             <div className="text-3xl font-bold text-green-600">{counts.gp}</div>
                                             <div className="text-xs text-green-800 font-bold uppercase">Good Practices</div>
                                         </div>
                                     </div>
                                 );
                             })()}
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Detailed Findings</h3>
                            {reportData.observations.length === 0 ? (
                                <p className="text-gray-400 italic">No specific observations recorded.</p>
                            ) : (
                                <table className="w-full text-left text-sm border rounded overflow-hidden">
                                    <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
                                            <tr>
                                                <th className="p-3 border w-32">Obs ID</th>
                                                <th className="p-3 border w-32">Type</th>
                                                <th className="p-3 border w-1/4">Area</th>
                                                <th className="p-3 border">Observation</th>
                                            </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {processObservations(reportData.observations, reportData.audit_id).map((obs, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 border font-mono font-bold text-gray-500 whitespace-nowrap">
                                                    {obs.displayId}
                                                </td>
                                                <td className="p-3 border">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${obs.badgeClass}`}>
                                                        {obs.type ? obs.type.split(' ')[0] : 'Note'} 
                                                    </span>
                                                </td>
                                                <td className="p-3 border font-medium text-gray-700">{obs.functional_area}</td>
                                                <td className="p-3 border text-gray-600 whitespace-pre-wrap">{obs.observation_text}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="mt-20 pt-10 border-t flex justify-between text-sm text-gray-500">
                            <div><p>__________________________</p><p>Auditor Signature</p></div>
                            <div><p>__________________________</p><p>Auditee Acknowledgment</p></div>
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