import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Search, RefreshCw, Calendar, MapPin, User, Trash2,
  CalendarClock, Filter, X, ChevronLeft, ChevronRight,
  Download, ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit3, Save
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import config from "../config";

const PlannedAudits = () => {
  const navigate = useNavigate();

  // =========================
  // 1. STATE MANAGEMENT
  // =========================
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "audit_id", direction: "descending" });

  // Modals
  const [viewData, setViewData] = useState(null);
  const [editData, setEditData] = useState(null);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    schedule_start_date: "",
    schedule_end_date: "",
    status: "",
    functional_area: "" // 🟢 ENSURE THIS IS HERE
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const API_URL = config.API_URL;
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } 
    catch (e) { return null; }
  }, []);

  // =========================
  // 2. HELPERS
  // =========================
  
  // Convert ISO (2025-12-22T...) to Input (2025-12-22)
  const toInputDate = (isoString) => {
    if (!isoString) return "";
    try {
       const d = new Date(isoString);
       if(isNaN(d.getTime())) return "";
       return d.toISOString().split('T')[0];
    } catch(e) { return ""; }
  };

  // Display Date (dd-mm-yyyy)
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  };

  // Helper for status badges
  const getStatusColor = (status) => {
    switch (status) {
      case "Completed": return "bg-purple-100 text-purple-700 border-purple-200";
      case "Scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
      case "Planned": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  // CSV Helper
  const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  // =========================
  // 3. API ACTIONS
  // =========================

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "audits/plans", userEmail: currentUser?.email }),
      });
      const result = await response.json();

      if (result?.status === "success" && Array.isArray(result.data)) {
        const data = result.data.map((p) => ({
          ...p,
          audit_id: p.audit_id || "",
          prakalpa_name: p.prakalpa_name || "Unknown Location",
          coordinator_name: p.coordinator_name || "Unassigned",
          status: p.status || "Planned",
          // Store raw date object for sorting/filtering
          dateObj: p.planned_date ? new Date(p.planned_date) : null,
        }));
        
        // Default sort: Newest ID first
        data.sort((a, b) => b.audit_id.localeCompare(a.audit_id));
        setPlans(data);
      } else {
        setPlans([]);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, currentUser]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleDelete = async (auditId) => {
    if (!window.confirm(`Are you sure you want to delete Audit ${auditId}?`)) return;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "audits/delete", audit_id: auditId, userEmail: currentUser?.email }),
      });
      const res = await response.json();
      if (res?.status === "success") {
        alert("Deleted successfully");
        fetchPlans();
      } else { alert("Error: " + (res?.message || "Failed")); }
    } catch (e) { alert("Delete failed"); }
  };

  // Open Modal and Pre-fill Data
  const openEditModal = (item) => {
    setEditData(item);
    setEditForm({
        // Handle dates carefully - try schedule dates first, fallback to planned date
        schedule_start_date: toInputDate(item.schedule_start_date || item.planned_date), 
        schedule_end_date: toInputDate(item.schedule_end_date || item.planned_date),
        status: item.status || "Planned",
        functional_area: item.functional_area || "" 
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editData) return;
    setSubmitting(true);
    
    const payload = {
        action: "audits/schedule", 
        userEmail: currentUser?.email,
        audit_id: editData.audit_id,
        start_date: editForm.schedule_start_date,
        end_date: editForm.schedule_end_date,
        status: editForm.status,
        functional_area: editForm.functional_area // Sending the new field
    };

    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        const res = await response.json();
        if (res.status === 'success') {
            alert("Audit updated successfully!");
            setEditData(null);
            fetchPlans();
        } else {
            alert("Update failed: " + res.message);
        }
    } catch (error) { alert("Network error"); } 
    finally { setSubmitting(false); }
  };

  const handleExport = () => {
    if (filteredPlans.length === 0) return alert("No data to export");
    const headers = ["Audit ID", "Prakalpa", "Functional Area", "Coordinator", "Planned Date", "Status"];
    const rows = filteredPlans.map(row => [
        csvEscape(row.audit_id), csvEscape(row.prakalpa_name), csvEscape(row.functional_area),
        csvEscape(row.coordinator_name), csvEscape(formatDate(row.planned_date)), csvEscape(row.status)
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Audit_Plans.csv`;
    link.click();
  };

  // =========================
  // 4. FILTERING & SORTING
  // =========================
  
  const uniqueStatuses = useMemo(() => [...new Set(plans.map((p) => p.status).filter(Boolean))].sort(), [plans]);
  const uniqueCoordinators = useMemo(() => [...new Set(plans.map((p) => p.coordinator_name).filter(Boolean))].sort(), [plans]);

  const filteredPlans = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const hasDateFilter = Boolean(startDate || endDate);
    
    return plans.filter((plan) => {
      const matchesSearch = !term || 
        (plan.audit_id || "").toLowerCase().includes(term) || 
        (plan.prakalpa_name || "").toLowerCase().includes(term) ||
        (plan.functional_area || "").toLowerCase().includes(term);
        
      const matchesStatus = statusFilter ? plan.status === statusFilter : true;
      const matchesCoordinator = coordinatorFilter ? plan.coordinator_name === coordinatorFilter : true;
      
      let matchesDate = true;
      if (hasDateFilter && !plan.dateObj) return false;
      if (startDate && plan.dateObj) matchesDate = matchesDate && plan.dateObj >= new Date(startDate);
      if (endDate && plan.dateObj) {
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && plan.dateObj <= end;
      }
      
      return matchesSearch && matchesStatus && matchesCoordinator && matchesDate;
    });
  }, [plans, searchTerm, statusFilter, coordinatorFilter, startDate, endDate]);

  const sortedPlans = useMemo(() => {
    const items = [...filteredPlans];
    const { key, direction } = sortConfig || {};
    if (!key) return items;
    
    const dir = direction === "ascending" ? 1 : -1;
    items.sort((a, b) => {
      if (key === "planned_date") {
        return ((a.dateObj ? a.dateObj.getTime() : 0) - (b.dateObj ? b.dateObj.getTime() : 0)) * dir;
      }
      return (a[key] ?? "").toString().toLowerCase().localeCompare((b[key] ?? "").toString().toLowerCase()) * dir;
    });
    return items;
  }, [filteredPlans, sortConfig]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedPlans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedPlans.length / itemsPerPage);

  const requestSort = (key) => {
    setSortConfig(prev => ({ 
      key, 
      direction: prev.key === key && prev.direction === "ascending" ? "descending" : "ascending" 
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-gray-300" />;
    return sortConfig.direction === "ascending" ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />;
  };

  const clearFilters = () => {
    setSearchTerm(""); setStatusFilter(""); setCoordinatorFilter(""); 
    setStartDate(""); setEndDate(""); setCurrentPage(1);
  };

  // =========================
  // 5. RENDER UI
  // =========================
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-blue-600" /> Audit Planning</h1>
            <p className="text-sm text-gray-500 mt-1">Manage, schedule, and track annual audits</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExport} className="bg-white border p-2 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-2 px-3 text-sm font-medium"><Download size={18} /> CSV</button>
            <button onClick={fetchPlans} className="bg-white border p-2 rounded-lg hover:bg-gray-50"><RefreshCw size={20} /></button>
            <button onClick={() => navigate("/planning/new")} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> Create Plan</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col xl:flex-row gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-3 text-gray-400" size={18} />
             <input type="text" placeholder="Search ID, Prakalpa, Area..." className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-100" 
               value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} />
           </div>
           
           <div className="relative w-full xl:w-48">
             <Filter className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg bg-white outline-none appearance-none cursor-pointer hover:bg-gray-50" 
                value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setCurrentPage(1);}}>
                <option value="">All Statuses</option>
                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>

           <div className="relative w-full xl:w-56">
             <User className="absolute left-3 top-3 text-gray-400" size={16} />
             <select className="w-full pl-9 pr-8 py-2.5 border rounded-lg bg-white outline-none appearance-none cursor-pointer hover:bg-gray-50" 
                value={coordinatorFilter} onChange={e => {setCoordinatorFilter(e.target.value); setCurrentPage(1);}}>
                <option value="">All Coordinators</option>
                {uniqueCoordinators.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>

           <div className="flex gap-2 items-center bg-white border rounded-lg p-1">
             <input type="date" className="px-2 py-1.5 text-sm text-gray-600 outline-none" value={startDate} onChange={e => {setStartDate(e.target.value); setCurrentPage(1);}} />
             <span className="text-gray-400">-</span>
             <input type="date" className="px-2 py-1.5 text-sm text-gray-600 outline-none" value={endDate} onChange={e => {setEndDate(e.target.value); setCurrentPage(1);}} />
           </div>

           {(searchTerm || statusFilter || coordinatorFilter || startDate || endDate) && (
             <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-bold whitespace-nowrap"><X size={18} /> Clear</button>
           )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th onClick={() => requestSort("audit_id")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer select-none hover:bg-gray-100"><div className="flex items-center gap-2">ID <SortIcon columnKey="audit_id"/></div></th>
                <th onClick={() => requestSort("prakalpa_name")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer select-none hover:bg-gray-100"><div className="flex items-center gap-2">Prakalpa <SortIcon columnKey="prakalpa_name"/></div></th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500">Functional Area</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500">Coordinator</th>
                <th onClick={() => requestSort("planned_date")} className="px-6 py-4 text-xs font-bold text-gray-500 cursor-pointer select-none hover:bg-gray-100"><div className="flex items-center gap-2">Planned Date <SortIcon columnKey="planned_date"/></div></th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan="7" className="p-12 text-center text-gray-500 animate-pulse">Loading data...</td></tr>}
              {!loading && currentItems.length === 0 && <tr><td colSpan="7" className="p-12 text-center text-gray-400">No audits found matching your criteria.</td></tr>}

              {currentItems.map((plan) => (
                <tr key={plan.audit_id} className="hover:bg-blue-50/50 transition duration-150">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">{plan.audit_id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800 flex items-center gap-2"><MapPin size={14} className="text-gray-400" /> {plan.prakalpa_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs border">{plan.functional_area}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2"><User size={14} className="text-gray-400" /> {plan.coordinator_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(plan.planned_date)}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>{plan.status}</span></td>
                  <td className="px-6 py-4 text-right flex justify-end gap-1">
                    <button onClick={() => setViewData(plan)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition" title="View"><Eye size={16} /></button>
                    <button onClick={() => openEditModal(plan)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit/Schedule"><Edit3 size={16} /></button>
                    <button onClick={() => handleDelete(plan.audit_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && filteredPlans.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
             <div className="text-sm text-gray-500">Showing <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredPlans.length)}</b> of <b>{filteredPlans.length}</b></div>
             <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16}/></button>
             </div>
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* 🟢 VIEW MODAL (Read Only) */}
      {viewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Eye className="text-blue-600"/> Audit Details</h3>
              <button onClick={() => setViewData(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><label className="text-xs font-bold text-gray-400 uppercase">Audit ID</label><p className="font-mono text-blue-600 font-bold mt-1">{viewData.audit_id}</p></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                      <div className="mt-1"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(viewData.status)}`}>{viewData.status}</span></div>
                  </div>
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-400 uppercase">Prakalpa</label><p className="text-gray-800 font-medium mt-1">{viewData.prakalpa_name}</p></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-400 uppercase">Functional Area</label><p className="text-gray-800 mt-1 bg-gray-50 p-2 rounded border">{viewData.functional_area}</p></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase">Coordinator</label><p className="text-gray-800 mt-1">{viewData.coordinator_name}</p></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase">Planned Date</label><p className="text-gray-800 mt-1">{formatDate(viewData.planned_date)}</p></div>
               </div>
               
               {viewData.schedule_start_date && (
                   <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                       <h4 className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-2"><CalendarClock size={14}/> Schedule Details</h4>
                       <div className="grid grid-cols-2 gap-2 text-sm">
                           <p className="text-blue-900"><strong>Start:</strong> {formatDate(viewData.schedule_start_date)}</p>
                           <p className="text-blue-900"><strong>End:</strong> {formatDate(viewData.schedule_end_date)}</p>
                       </div>
                   </div>
               )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setViewData(null)} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 EDIT / SCHEDULE MODAL (Form) */}
      {editData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleEditSubmit}>
                <div className="bg-blue-600 px-6 py-4 border-b flex justify-between items-center">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2"><CalendarClock/> Schedule / Edit Audit</h3>
                   <button type="button" onClick={() => setEditData(null)} className="text-blue-200 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-4 border border-blue-100">
                        Editing <strong>{editData.audit_id}</strong> for <strong>{editData.prakalpa_name}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                            {/* 🟢 Date Input (formatted yyyy-MM-dd) */}
                            <input type="date" className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" 
                                value={editForm.schedule_start_date} onChange={e => setEditForm({...editForm, schedule_start_date: e.target.value})} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                            <input type="date" className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" 
                                value={editForm.schedule_end_date} onChange={e => setEditForm({...editForm, schedule_end_date: e.target.value})} required />
                        </div>
                    </div>

                    {/* 🟢 NEW FUNCTIONAL AREA FIELD */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Functional Area</label>
                        <input type="text" className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                             placeholder="e.g. Academic Systems, HR, Infrastructure..."
                             value={editForm.functional_area} onChange={e => setEditForm({...editForm, functional_area: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
                        <select className="w-full border rounded p-2 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                             value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                             <option value="Planned">Planned</option>
                             <option value="Scheduled">Scheduled</option>
                             <option value="Completed">Completed</option>
                        </select>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
                    <button type="button" onClick={() => setEditData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-bold">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-bold flex items-center gap-2 shadow-sm">
                        {submitting ? "Saving..." : <><Save size={16}/> Save Changes</>}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlannedAudits;