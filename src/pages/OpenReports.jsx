import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, RefreshCw, Eye, X, 
  Download, Edit, Save, Plus, Trash2, CheckCircle, ArrowLeft, Settings, Info
} from 'lucide-react'; 
import { supabase } from '../supabase';
import { generateAuditReportPDF } from '../utils/printAuditReport';
import { normalizeAuditID } from '../utils/idHelper';

const OpenReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // MAIN MODAL STATE
  const [selectedReport, setSelectedReport] = useState(null); 
  const [reportDetails, setReportDetails] = useState(null);   
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // EDIT MODE STATE
  const [isEditing, setIsEditing] = useState(false);
  const [editObservations, setEditObservations] = useState([]); 
  const [saving, setSaving] = useState(false);

  // AUTH
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';
  const isCoordinator = currentUser.role.includes('Coordinator') || isAdmin;

  // =========================
  // 1. FETCH AUDIT LIST
  // =========================
  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_plan')
        .select('*')
        .eq('status', 'Completed') 
        .order('schedule_end_date', { ascending: false });

      if (!isAdmin) {
          const myName = currentUser.full_name || 'Unknown';
          const myLoc = currentUser.prakalpa_name || 'Unknown';
          query = query.or(`coordinator_name.eq.${myName},prakalpa_name.eq.${myLoc}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // =========================
  // 2. MODAL HANDLERS (VIEW & EDIT)
  // =========================

  const handleViewReport = async (audit) => {
    setSelectedReport(audit);
    setIsEditing(false); 
    setLoadingDetails(true);
    try {
        const cleanId = normalizeAuditID(audit.audit_id);

        const { data, error } = await supabase
            .from('audit_observations')
            .select('*')
            .eq('audit_id', cleanId);

        if (error) throw error;

        const sortedData = (data || []).sort((a, b) => 
            (a.observation_id || "").localeCompare(b.observation_id || "")
        );

        setReportDetails({ ...audit, observations: sortedData });
    } catch (e) { 
        console.error("Fetch Error:", e); 
        alert("Error loading observations: " + e.message);
    } finally { 
        setLoadingDetails(false); 
    }
  };

  const handleStartEdit = () => {
      const buffer = reportDetails.observations.map(o => ({...o}));
      setEditObservations(buffer);
      setIsEditing(true);
  };

  const handleCancelEdit = () => {
      setIsEditing(false);
      setEditObservations([]);
  };

  // =========================
  // 3. EDIT LOGIC (CRUD)
  // =========================

  const handleAddObservation = () => {
      const cleanId = normalizeAuditID(selectedReport.audit_id);

      setEditObservations([
          ...editObservations, 
          { 
              temp_ui_id: `new-${Date.now()}`, 
              audit_id: cleanId, 
              type: 'Opportunity for Improvement (OFI)', 
              observation_text: '', 
              functional_area: selectedReport.functional_area,
              isNew: true 
          }
      ]);
  };

  const handleDeleteObservation = async (index) => {
      const obs = editObservations[index];
      
      if (!obs.isNew) {
          if(!window.confirm("Delete this observation permanently?")) return;
          
          let query = supabase.from('audit_observations').delete();
          
          if (obs.id) {
              query = query.eq('id', obs.id);
          } else if (obs.observation_id) {
              query = query.eq('observation_id', obs.observation_id);
          } else {
              alert("Cannot delete: No unique ID found.");
              return;
          }

          const { error } = await query;
          if (error) { alert("Delete failed: " + error.message); return; }
      }
      
      const updated = editObservations.filter((_, i) => i !== index);
      setEditObservations(updated);
  };

  const handleObsChange = (index, field, value) => {
      const updated = [...editObservations];
      updated[index][field] = value;
      setEditObservations(updated);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
        // 🟢 CALCULATION BASE: Use the original Report Date to keep timelines consistent
        // If undefined, default to today.
        const baseDateStr = selectedReport.completion_date || selectedReport.schedule_end_date || new Date().toISOString();
        const baseDate = new Date(baseDateStr);

        const updates = editObservations.map(async (obs) => {
            // 🟢 LOGIC: Calculate Target Date (30 days NC / 60 days OFI)
            const target = new Date(baseDate); // Clone report date
            const typeLower = (obs.type || '').toLowerCase();
            
            if (typeLower.includes('non') || typeLower.includes('nc')) {
                target.setDate(baseDate.getDate() + 30);
            } else {
                target.setDate(baseDate.getDate() + 60);
            }
            const targetDateStr = target.toISOString().split('T')[0];

            if (obs.isNew) {
                const cleanId = normalizeAuditID(selectedReport.audit_id);
                const { temp_ui_id, isNew, id, ...payload } = obs; 
                payload.audit_id = cleanId;
                payload.target_date = targetDateStr; // 🟢 Save Target
                return supabase.from('audit_observations').insert([payload]);
            } else {
                const payload = { 
                    observation_text: obs.observation_text,
                    type: obs.type,
                    functional_area: obs.functional_area,
                    target_date: targetDateStr // 🟢 Update Target
                };

                if (obs.id) {
                    return supabase.from('audit_observations').update(payload).eq('id', obs.id);
                } else if (obs.observation_id) {
                    return supabase.from('audit_observations').update(payload).eq('observation_id', obs.observation_id);
                }
            }
        });

        await Promise.all(updates);

        const cleanId = normalizeAuditID(selectedReport.audit_id);
        const { data } = await supabase
            .from('audit_observations')
            .select('*')
            .eq('audit_id', cleanId);

        const sortedData = (data || []).sort((a, b) => (a.observation_id || "").localeCompare(b.observation_id || ""));
        
        setReportDetails({ ...selectedReport, observations: sortedData });
        setIsEditing(false); 
        alert("Report updated successfully!");

    } catch (error) {
        alert("Failed to save: " + error.message);
    } finally {
        setSaving(false);
    }
  };

  // =========================
  // 4. HELPERS
  // =========================
  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try { 
        const d = new Date(dateVal); 
        if(isNaN(d.getTime())) return dateVal; 
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) { return dateVal; }
  };

  // 🟢 Helper to calculate display deadlines
  const getDeadlines = (dateStr) => {
      if (!dateStr) return { nc: 'N/A', ofi: 'N/A' };
      try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return { nc: 'N/A', ofi: 'N/A' };
          
          const ncDate = new Date(d); ncDate.setDate(d.getDate() + 30);
          const ofiDate = new Date(d); ofiDate.setDate(d.getDate() + 60);
          
          return { 
              nc: formatDate(ncDate), 
              ofi: formatDate(ofiDate) 
          };
      } catch (e) { return { nc: 'N/A', ofi: 'N/A' }; }
  };

  const getReportRef = (id) => (id || "REF").replace("IQA", "IAR");

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

  const filteredReports = reports.filter(r => 
    (r.prakalpa_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-green-600" /> Audit Reports
          </h1>
          <p className="text-sm text-gray-500">View and manage finalized reports.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input className="pl-10 pr-4 py-2 border rounded-lg" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
            <button onClick={fetchData} className="p-2 border rounded hover:bg-gray-50"><RefreshCw size={20}/></button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border no-print">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Report ID</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Completion Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading && filteredReports.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono font-bold text-green-700">{getReportRef(row.audit_id)}</td>
                <td className="px-6 py-4 font-bold">{row.prakalpa_name}</td>
                <td className="px-6 py-4">{formatDate(row.completion_date || row.schedule_end_date)}</td>
                <td className="px-6 py-4 text-right">
                    <button onClick={() => handleViewReport(row)} className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all shadow-sm">
                        <Eye size={16}/> Manage Report
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* UNIFIED MODAL (VIEW & EDIT) */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto backdrop-blur-sm flex justify-center items-start pt-10 pb-10 print:bg-white print:fixed print:inset-0 print:pt-0">
            <div className="bg-white w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
                
                {/* MODAL HEADER */}
                <div className={`${isEditing ? 'bg-orange-600' : 'bg-gray-800'} text-white px-6 py-4 flex justify-between items-center no-print transition-colors duration-300`}>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        {isEditing ? <><Edit size={20}/> Edit Findings</> : "Report Viewer"}
                    </h2>
                    <div className="flex gap-3">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancelEdit} disabled={saving} className="text-white/80 hover:text-white text-sm font-bold underline">Cancel</button>
                                <button onClick={handleSaveChanges} disabled={saving} className="bg-white text-orange-700 hover:bg-orange-50 px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                                    {saving ? "Saving..." : <><Save size={16}/> Save Changes</>}
                                </button>
                            </>
                        ) : (
                            <>
                                {isCoordinator && (
                                    <button onClick={handleStartEdit} className="bg-orange-500 hover:bg-orange-400 px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                                        <Edit size={16}/> Edit Findings
                                    </button>
                                )}
                                <button onClick={() => generateAuditReportPDF(reportDetails)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                                    <Download size={16}/> PDF
                                </button>
                                <button onClick={() => setSelectedReport(null)}><X size={24} className="text-gray-400 hover:text-white"/></button>
                            </>
                        )}
                    </div>
                </div>

                {/* MODAL CONTENT */}
                <div className="p-10 min-h-[500px] print:p-0">
                    {loadingDetails || !reportDetails ? (
                        <div className="text-center p-10 text-gray-500">Loading Report Data...</div>
                    ) : (
                        <div className="space-y-8">
                            
                            {/* HEADER SECTION */}
                            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 uppercase">Internal Quality Audit Report</h1>
                                    <p className="text-gray-500 mt-1">Rashtrotthana Parishat • 2025-26</p>
                                    <p className="text-sm font-mono text-gray-600 mt-1">Ref: <strong>{getReportRef(selectedReport.audit_id)}</strong></p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-mono font-bold text-gray-600">{selectedReport.audit_id}</div>
                                    <div className="text-sm text-green-600 font-bold uppercase border border-green-600 px-2 py-0.5 rounded inline-block mt-1">COMPLETED</div>
                                </div>
                            </div>

                            {/* METADATA GRID */}
                            <div className="grid grid-cols-2 gap-8 bg-gray-50 p-6 rounded-lg print:border print:bg-white">
                                <div><h3 className="text-xs font-bold text-gray-400 uppercase">Location</h3><p className="font-bold text-gray-800">{selectedReport.prakalpa_name}</p></div>
                                <div><h3 className="text-xs font-bold text-gray-400 uppercase">Functional Area</h3><p className="font-bold text-gray-800">{selectedReport.functional_area}</p></div>
                                <div><h3 className="text-xs font-bold text-gray-400 uppercase">Coordinator</h3><p className="text-gray-700">{selectedReport.coordinator_name}</p></div>
                                <div><h3 className="text-xs font-bold text-gray-400 uppercase">Completed Date</h3><p className="text-gray-700">{formatDate(selectedReport.completion_date || selectedReport.schedule_end_date)}</p></div>
                            </div>

                            {/* MODE SWITCHER */}
                            {isEditing ? (
                                // EDIT MODE CONTENT
                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-orange-800 flex items-center gap-2"><Edit size={18}/> Editing Observations</h3>
                                        <button onClick={handleAddObservation} className="bg-white border border-orange-200 text-orange-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm hover:bg-orange-100 flex items-center gap-2">
                                            <Plus size={16}/> Add Observation
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {editObservations.length === 0 && <p className="text-center text-gray-400 italic py-4">No observations found. Add one above.</p>}
                                        
                                        {editObservations.map((obs, idx) => (
                                            <div key={obs.id || obs.temp_ui_id || idx} className="bg-white border rounded p-4 shadow-sm relative group">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Observation #{idx + 1}</span>
                                                    <button onClick={() => handleDeleteObservation(idx)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                                                </div>
                                                <select className="w-full border rounded px-2 py-2 text-sm font-bold bg-gray-50 mb-2" 
                                                    value={obs.type} onChange={(e) => handleObsChange(idx, 'type', e.target.value)}>
                                                    <option value="Non-Conformance (NC)">Non-Conformance (NC)</option>
                                                    <option value="Opportunity for Improvement (OFI)">Opportunity (OFI)</option>
                                                    <option value="Good Practice (GP)">Good Practice (GP)</option>
                                                </select>
                                                <textarea className="w-full border rounded p-3 text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none" rows="2" 
                                                    placeholder="Describe the observation..."
                                                    value={obs.observation_text} onChange={(e) => handleObsChange(idx, 'observation_text', e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // VIEW MODE CONTENT
                                <>
                                    {/* Executive Summary Cards */}
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Executive Summary</h3>
                                        {(() => {
                                            const counts = getCounts(reportDetails.observations);
                                            return (
                                                <div className="flex gap-4">
                                                    <div className="flex-1 bg-red-50 border border-red-100 p-4 rounded text-center">
                                                        <div className="text-3xl font-bold text-red-600">{counts.nc}</div>
                                                        <div className="text-xs text-red-800 font-bold uppercase">Non-Conformances</div>
                                                    </div>
                                                    <div className="flex-1 bg-blue-50 border border-blue-100 p-4 rounded text-center">
                                                        <div className="text-3xl font-bold text-blue-600">{counts.ofi}</div>
                                                        <div className="text-xs text-blue-800 font-bold uppercase">Opportunities</div>
                                                    </div>
                                                    <div className="flex-1 bg-green-50 border border-green-100 p-4 rounded text-center">
                                                        <div className="text-3xl font-bold text-green-600">{counts.gp}</div>
                                                        <div className="text-xs text-green-800 font-bold uppercase">Good Practices</div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* 🟢 NEW: Action Mandate Instructions */}
                                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-start gap-3">
                                       <Info size={18} className="mt-0.5 shrink-0 text-blue-600"/>
                                       {(() => {
                                           // Calculate Deadlines for Display
                                           const { nc, ofi } = getDeadlines(selectedReport.completion_date || selectedReport.schedule_end_date);
                                           return (
                                               <div className="leading-relaxed">
                                                  <strong>Action Mandate & Instructions:</strong>
                                                  <ul className="list-disc list-inside mt-1 space-y-1">
                                                      <li><strong>Non-Conformances (NC)</strong> must be closed within <strong>30 days</strong> ({nc}).</li>
                                                      <li><strong>Opportunities for Improvement (OFI)</strong> must be addressed within <strong>60 days</strong> ({ofi}).</li>
                                                  </ul>
                                               </div>
                                           );
                                       })()}
                                    </div>

                                    {/* Detailed Findings Table */}
                                    <div className="mt-8">
                                        <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Detailed Findings</h3>
                                        {reportDetails.observations.length === 0 ? (
                                            <p className="text-gray-400 italic">No observations recorded.</p>
                                        ) : (
                                            <table className="w-full text-left text-sm border rounded overflow-hidden">
                                                <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
                                                    <tr>
                                                        <th className="p-3 border w-32">Obs ID</th>
                                                        <th className="p-3 border w-48">Type</th>
                                                        <th className="p-3 border">Observation</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {processObservations(reportDetails.observations, selectedReport.audit_id).map((obs, i) => (
                                                        <tr key={i} className="hover:bg-gray-50">
                                                            <td className="p-3 border font-mono font-bold text-gray-500 whitespace-nowrap">{obs.displayId}</td>
                                                            <td className="p-3 border">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${obs.badgeClass}`}>
                                                                    {obs.type && obs.type.includes('Opportunity') ? 'Opportunity for Improvement' : (obs.type ? obs.type.split(' ')[0] : '-')}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 border text-gray-600 whitespace-pre-wrap">{obs.observation_text}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                    
                                    {/* Footer */}
                                    <div className="mt-20 pt-10 border-t flex justify-between text-sm text-gray-500 print:mt-10">
                                        <div><p>__________________________</p><p>Auditor Signature</p></div>
                                        <div><p>__________________________</p><p>Auditee Acknowledgment</p></div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default OpenReports;