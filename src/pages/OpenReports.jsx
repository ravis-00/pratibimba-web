import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Eye, X, Printer } from 'lucide-react';
import { supabase } from '../supabase';

const OpenReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Report Modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 🟢 1. GET CURRENT USER & ROLE
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  // 1. Fetch Completed Audits
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Start Query
      let query = supabase
        .from('audit_plan')
        .select('*')
        .eq('status', 'Completed') // Only completed reports
        .order('completion_date', { ascending: false }); // Newest first

      // 🟢 2. RBAC FILTERING
      // If NOT Admin, strictly filter reports by Coordinator Name
      if (!isAdmin) {
          query = query.eq('coordinator_name', currentUser.full_name);
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

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Fetch Full Details for Viewer
  const handleViewReport = async (audit) => {
    setSelectedReport(audit);
    setLoadingDetails(true);
    try {
        // Fetch Observations linked to this audit
        const { data: findings, error } = await supabase
            .from('audit_observations')
            .select('*')
            .eq('audit_id', audit.audit_id);

        if (error) throw error;

        setReportDetails({
            ...audit,
            observations: findings || []
        });

    } catch (e) { 
        console.error(e); 
    } finally { 
        setLoadingDetails(false); 
    }
  };

  const handlePrint = () => {
      window.print();
  };

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

  // Generate Report Ref ID (e.g. IAR25154)
  const getReportRef = (auditId) => {
      if(!auditId) return "REF-000";
      return auditId.replace("IQA", "IAR"); // Internal Quality Audit -> Internal Audit Report
  };

  const filteredReports = reports.filter(r => 
    (r.prakalpa_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🟢 Helper to calculate counts safely
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-green-600" /> Audit Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
             {isAdmin ? "View and print finalized audit reports." : `Reports for audits coordinated by ${currentUser.full_name}`}
          </p>
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search Report ID or Location..." 
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded">
                <RefreshCw size={20}/>
            </button>
        </div>
      </div>

      {/* REPORT LIST TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200 no-print">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Report ID</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Functional Area</th>
              <th className="px-6 py-4">Completion Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan="5" className="p-6 text-center">Loading...</td></tr>}
            {!loading && filteredReports.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No completed audits found.</td></tr>
            )}
            {!loading && filteredReports.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs text-green-600 font-bold">{getReportRef(row.audit_id)}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{row.prakalpa_name}</td>
                <td className="px-6 py-4">{row.functional_area}</td>
                <td className="px-6 py-4 text-gray-700">{formatDate(row.completion_date || row.schedule_end_date)}</td>
                <td className="px-6 py-4 text-right">
                    <button onClick={() => handleViewReport(row)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ml-auto">
                      <Eye size={14}/> View Report
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REPORT VIEWER MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto backdrop-blur-sm flex justify-center items-start pt-10 pb-10 print:bg-white print:fixed print:inset-0 print:pt-0">
          <div className="bg-white w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
            
            {/* Modal Header */}
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center no-print">
                <h2 className="font-bold text-lg">Audit Report Viewer</h2>
                <div className="flex gap-3">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm transition">
                        <Printer size={16}/> Print / PDF
                    </button>
                    <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white">
                        <X size={24}/>
                    </button>
                </div>
            </div>

            {/* THE REPORT */}
            <div className="p-10 min-h-[500px] print:p-0">
                {loadingDetails ? (
                    <div className="text-center p-10 text-gray-500">Generating Report...</div>
                ) : reportDetails ? (
                    <div className="space-y-8">
                        
                        {/* 1. TITLE HEADER */}
                        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wide">Internal Audit Report</h1>
                                <p className="text-gray-500 mt-1">Pratibimba Audit System • 2025-26</p>
                                <p className="text-sm font-mono text-gray-600 mt-1">
                                    Report Ref: <strong>{getReportRef(selectedReport.audit_id)}</strong>
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-mono font-bold text-gray-600">
                                    {selectedReport.audit_id}
                                </div>
                                <div className="text-sm text-green-600 font-bold uppercase border border-green-600 px-2 py-0.5 rounded inline-block mt-1">
                                    COMPLETED
                                </div>
                            </div>
                        </div>

                        {/* 2. AUDIT META DATA */}
                        <div className="grid grid-cols-2 gap-8 bg-gray-50 p-6 rounded-lg print:bg-transparent print:p-0 print:border">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Location (Prakalpa)</h3>
                                <p className="text-lg font-bold text-gray-800">{selectedReport.prakalpa_name}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Functional Area</h3>
                                <p className="text-lg font-bold text-gray-800">{selectedReport.functional_area}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Audit Team</h3>
                                <p className="text-sm text-gray-700"><strong>Coordinator:</strong> {selectedReport.coordinator_name || 'N/A'}</p>
                                <p className="text-sm text-gray-700"><strong>Auditors:</strong> {selectedReport.assigned_auditors || 'N/A'}</p>
                                <p className="text-sm text-gray-700"><strong>Auditees:</strong> {selectedReport.assigned_auditees || 'N/A'}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Timeline</h3>
                                <p className="text-sm text-gray-700">
                                    <strong>Scheduled:</strong> {formatDate(selectedReport.schedule_start_date)}
                                </p>
                                <p className="text-sm text-gray-700">
                                    <strong>Completed:</strong> {formatDate(selectedReport.completion_date || selectedReport.schedule_end_date)}
                                </p>
                            </div>
                        </div>

                        {/* 3. EXECUTIVE SUMMARY */}
                        <div>
                             <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Executive Summary</h3>
                             {/* 🟢 USE HELPER FUNCTION FOR COUNTS */}
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

                        {/* 4. DETAILED FINDINGS */}
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Detailed Findings</h3>
                            {reportDetails.observations.length === 0 ? (
                                <p className="text-gray-400 italic">No specific observations recorded.</p>
                            ) : (
                                <table className="w-full text-left text-sm border">
                                    <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="p-3 border">Type</th>
                                            <th className="p-3 border">Area</th>
                                            <th className="p-3 border">Observation</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {reportDetails.observations.map((obs, i) => {
                                            const t = (obs.type || "").toLowerCase();
                                            let badgeClass = 'bg-gray-100 text-gray-800';
                                            if(t.includes('non') || t.includes('nc')) badgeClass = 'bg-red-100 text-red-800';
                                            else if(t.includes('improvement') || t.includes('opportunity')) badgeClass = 'bg-blue-100 text-blue-800';
                                            else if(t.includes('good') || t.includes('compliant')) badgeClass = 'bg-green-100 text-green-800';

                                            return (
                                                <tr key={i}>
                                                    <td className="p-3 border w-32">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${badgeClass}`}>
                                                            {obs.type ? obs.type.split(' ')[0] : 'Note'} 
                                                        </span>
                                                    </td>
                                                    <td className="p-3 border w-1/4 font-medium text-gray-700">{obs.functional_area}</td>
                                                    <td className="p-3 border text-gray-600 whitespace-pre-wrap">{obs.observation_text}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* 5. FOOTER */}
                        <div className="mt-20 pt-10 border-t flex justify-between text-sm text-gray-500 print:mt-10">
                            <div>
                                <p>__________________________</p>
                                <p>Auditor Signature</p>
                            </div>
                            <div>
                                <p>__________________________</p>
                                <p>Auditee Acknowledgment</p>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="text-red-500">Failed to load report data.</div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenReports;