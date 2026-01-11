import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Eye, X, Printer } from 'lucide-react';
import config from '../config';

const OpenReports = () => {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Report Modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const API_URL = config.API_URL;
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const payload = { userEmail: currentUser.email };
      
      const [auditRes, userRes] = await Promise.all([
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'audits/list', ...payload }) }),
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'meta/users', ...payload }) })
      ]);

      const [auditData, userData] = await Promise.all([auditRes.json(), userRes.json()]);
      
      if (auditData.status === 'success') {
        const completedOnly = (auditData.data || []).filter(a => a.status === 'Completed');
        setReports(completedOnly);
      }
      if (userData.status === 'success') {
        setUsers(userData.data || []);
      }

    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (audit) => {
    setSelectedReport(audit);
    setLoadingDetails(true);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'audits/execution/get', userEmail: currentUser.email, audit_id: audit.audit_id })
        });
        const result = await response.json();
        if (result.status === 'success') {
            setReportDetails(result.data);
        }
    } catch (e) { console.error(e); } 
    finally { setLoadingDetails(false); }
  };

  const handlePrint = () => {
      window.print();
  };

  const getNames = (emailString) => {
    if (!emailString) return 'None';
    const emails = emailString.split(',').map(e => e.trim().toLowerCase());
    
    const names = emails.map(email => {
        const user = users.find(u => (u.email || '').toLowerCase() === email);
        return user ? user.full_name : email; 
    });
    
    return names.join(', ');
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

  // 🟢 SMART ID GENERATOR (Fixes OBS-1 issue)
  const getDisplayID = (currentObs, allObs) => {
    // 1. If DB already has the correct code (e.g. NC-01), use it.
    if (currentObs.finding_code && !currentObs.finding_code.startsWith('OBS')) {
        return currentObs.finding_code;
    }

    // 2. Fallback: Calculate ID on the fly
    let prefix = "OBS";
    if (currentObs.type.includes("Non-Conformance")) prefix = "NC";
    else if (currentObs.type.includes("Improvement")) prefix = "OFI";
    else if (currentObs.type.includes("Good") || currentObs.type.includes("Compliant")) prefix = "GP";

    // Filter all obs to find ones with the same prefix (same type)
    const sameTypeObs = allObs.filter(o => {
        let p = "OBS";
        if (o.type.includes("Non-Conformance")) p = "NC";
        else if (o.type.includes("Improvement")) p = "OFI";
        else if (o.type.includes("Good") || o.type.includes("Compliant")) p = "GP";
        return p === prefix;
    });

    // Find the index of the current one
    const index = sameTypeObs.findIndex(o => o.observation_id === currentObs.observation_id);
    const serial = String(index + 1).padStart(2, '0');

    return `${prefix}-${serial}`;
  };

  const filteredReports = reports.filter(r => 
    (r.location_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          <p className="text-sm text-gray-500 mt-1">View and print finalized audit reports.</p>
        </div>
        <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded">
            <RefreshCw size={20}/>
        </button>
      </div>

      {/* REPORT LIST TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200 no-print">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">Audit ID</th>
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
                <td className="px-6 py-4 font-mono text-xs text-green-600 font-bold">{row.audit_id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{row.location_name}</td>
                <td className="px-6 py-4">{row.functional_area}</td>
                <td className="px-6 py-4 text-gray-700">{formatDate(row.completion_date)}</td>
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
                                    Report Ref: <strong>{selectedReport.report_id || selectedReport.audit_id.replace("IQA", "IAR")}</strong>
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
                                <p className="text-lg font-bold text-gray-800">{selectedReport.location_name}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Functional Area</h3>
                                <p className="text-lg font-bold text-gray-800">{selectedReport.functional_area}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Audit Team</h3>
                                <p className="text-sm text-gray-700"><strong>Auditors:</strong> {getNames(selectedReport.assigned_auditors)}</p>
                                <p className="text-sm text-gray-700"><strong>Auditees:</strong> {getNames(selectedReport.assigned_auditees)}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Timeline</h3>
                                <p className="text-sm text-gray-700">
                                    <strong>Scheduled:</strong> {formatDate(selectedReport.schedule_start_date)}
                                </p>
                                <p className="text-sm text-gray-700">
                                    <strong>Completed:</strong> {formatDate(selectedReport.completion_date)}
                                </p>
                            </div>
                        </div>

                        {/* 3. EXECUTIVE SUMMARY */}
                        <div>
                             <h3 className="font-bold text-gray-800 text-lg border-b mb-4">Executive Summary</h3>
                             <div className="flex gap-4">
                                 <div className="flex-1 bg-red-50 border border-red-100 p-4 rounded text-center">
                                     <div className="text-3xl font-bold text-red-600">
                                         {reportDetails.observations.filter(o => o.type.includes('Non-Conformance')).length}
                                     </div>
                                     <div className="text-xs text-red-800 font-bold uppercase">Non-Conformances</div>
                                 </div>
                                 <div className="flex-1 bg-blue-50 border border-blue-100 p-4 rounded text-center">
                                     <div className="text-3xl font-bold text-blue-600">
                                         {reportDetails.observations.filter(o => o.type.includes('Improvement')).length}
                                     </div>
                                     <div className="text-xs text-blue-800 font-bold uppercase">Opportunities (OFI)</div>
                                 </div>
                                 <div className="flex-1 bg-green-50 border border-green-100 p-4 rounded text-center">
                                     <div className="text-3xl font-bold text-green-600">
                                         {reportDetails.observations.filter(o => o.type.includes('Good') || o.type.includes('Compliant')).length}
                                     </div>
                                     <div className="text-xs text-green-800 font-bold uppercase">Good Practices</div>
                                 </div>
                             </div>
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
                                            <th className="p-3 border">Ref ID</th>
                                            <th className="p-3 border">Type</th>
                                            <th className="p-3 border">Area</th>
                                            <th className="p-3 border">Observation</th>
                                            <th className="p-3 border">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {reportDetails.observations.map((obs, i) => (
                                            <tr key={i}>
                                                {/* 🟢 USE SMART ID GENERATOR */}
                                                <td className="p-3 border font-mono font-bold text-gray-600 w-24">
                                                    {getDisplayID(obs, reportDetails.observations)}
                                                </td>
                                                
                                                <td className="p-3 border w-32">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${obs.type.includes('Non') ? 'bg-red-100 text-red-800' : (obs.type.includes('Improvement') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}`}>
                                                        {obs.type.split(' ')[0]} 
                                                    </span>
                                                </td>
                                                <td className="p-3 border w-1/4 font-medium text-gray-700">{obs.functional_area}</td>
                                                <td className="p-3 border text-gray-600 whitespace-pre-wrap">{obs.observation_text}</td>
                                                
                                                <td className="p-3 border w-24">
                                                    {obs.status === 'Open' ? (
                                                        <span className="text-red-600 font-bold text-xs">OPEN</span>
                                                    ) : (
                                                        <span className="text-green-600 font-bold text-xs">CLOSED</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
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