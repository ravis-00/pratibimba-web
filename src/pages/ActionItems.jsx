import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, Send, XCircle, Check, Archive, List } from 'lucide-react';
import config from '../config';

const ActionItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); 
  const [formData, setFormData] = useState({ root_cause: '', corrective_action: '', target_date: '', remarks: '' });
  
  const [activeTab, setActiveTab] = useState('pending');

  const API_URL = config.API_URL;
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isAuditor = currentUser.role.includes('Coordinator') || currentUser.role.includes('Admin');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'capa/list', userEmail: currentUser.email })
      });
      const res = await response.json();
      if (res.status === 'success') setItems(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openModal = (item) => {
    setSelectedItem(item);
    setFormData({
        root_cause: item.root_cause || '',
        corrective_action: item.corrective_action || '',
        target_date: item.target_date || '',
        remarks: ''
    });
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
        const payload = { 
            action: 'capa/submit', 
            userEmail: currentUser?.email, // 🟢 CRITICAL FIX: Added this line
            observation_id: selectedItem.observation_id,
            ...formData 
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            alert("✅ Action Plan Submitted Successfully!");
            setSelectedItem(null);
            fetchItems(); // Refresh list
        } else {
            alert("❌ Error: " + result.message);
        }
    } catch (error) {
        alert("❌ Network Error");
    } finally {
        setSubmitting(false);
    }
  };

  const handleVerify = async (decision) => {
    setSubmitting(true);
    try {
        const payload = { 
            action: 'capa/verify', 
            userEmail: currentUser?.email, // 🟢 CRITICAL FIX: Added this line
            observation_id: selectedItem.observation_id,
            decision: decision, 
            remarks: formData.remarks
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if(result.status === 'success') {
            alert(`✅ Observation marked as ${decision === 'Approve' ? 'Closed' : 'Open'}`);
            setSelectedItem(null);
            fetchItems();
        } else {
            alert("❌ Error: " + result.message);
        }
    } catch (error) { 
        alert("❌ Verification Failed"); 
    } finally { 
        setSubmitting(false); 
    }
  };

  // 🟢 HELPER: Format Date to dd-mm-yyyy
  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
        const d = new Date(dateVal);
        if(isNaN(d.getTime())) return dateVal; // Return original if parsing fails
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) { return dateVal; }
  };

  const getStatusBadge = (status) => {
      if(status === 'Pending Review') return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center gap-1"><Clock size={12}/> Review Needed</span>;
      if(status === 'Open') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center gap-1"><AlertTriangle size={12}/> Action Required</span>;
      if(status === 'Closed') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> Closed</span>;
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{status}</span>;
  };

  const displayedItems = items.filter(item => {
      if (activeTab === 'pending') return item.status !== 'Closed';
      if (activeTab === 'history') return item.status === 'Closed';
      return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="text-purple-600"/> My Action Items (CAPA)
        </h1>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'pending' ? 'bg-white text-purple-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <List size={16}/> To-Do ({items.filter(i => i.status !== 'Closed').length})
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'history' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Archive size={16}/> History ({items.filter(i => i.status === 'Closed').length})
            </button>
        </div>
      </div>

      <div className="grid gap-4">
        {loading && <p>Loading actions...</p>}
        {!loading && displayedItems.length === 0 && (
            <div className="text-center p-10 bg-gray-50 rounded border border-dashed border-gray-300">
                <p className="text-gray-400 italic">No {activeTab} items found.</p>
            </div>
        )}
        
        {displayedItems.map((item, i) => (
            <div key={i} className={`bg-white p-5 rounded-lg shadow border-l-4 flex justify-between items-start ${item.status === 'Closed' ? 'border-green-500 opacity-75' : 'border-purple-500'}`}>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        {/* 🟢 FIXED: Prioritize finding_code (NC-01) over observation_id */}
                        <span className="font-mono font-bold text-gray-500 text-sm">
                            {item.finding_code || item.observation_id}
                        </span>
                        {getStatusBadge(item.status)}
                        <span className="text-xs text-gray-400">Audit: {item.audit_id} ({item.location_name})</span>
                    </div>
                    <p className="text-gray-800 font-medium mb-1">{item.observation_text}</p>
                    
                    {item.root_cause && (
                        <div className="mt-3 bg-gray-50 p-2 rounded text-sm text-gray-600 border border-gray-100">
                            <p><strong>Root Cause:</strong> {item.root_cause}</p>
                            <p><strong>Action:</strong> {item.corrective_action}</p>
                            {item.status === 'Closed' && item.auditor_remarks && (
                                <p className="mt-2 text-green-700 border-t pt-2"><strong>Auditor Note:</strong> {item.auditor_remarks}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="ml-4 flex flex-col gap-2">
                    {item.status !== 'Closed' && (
                        <>
                            {(currentUser.role === 'Admin' || !isAuditor) && item.status === 'Open' && (
                                <button onClick={() => openModal(item)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 whitespace-nowrap">
                                    Respond
                                </button>
                            )}
                            {isAuditor && item.status === 'Pending Review' && (
                                <button onClick={() => openModal(item)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 whitespace-nowrap">
                                    Verify Closure
                                </button>
                            )}
                        </>
                    )}
                    {item.status === 'Closed' && (
                        <span className="text-xs text-gray-400 font-mono">
                            {/* 🟢 FIXED: Use formatDate helper here */}
                            Closed on: {formatDate(item.closure_date)}
                        </span>
                    )}
                </div>
            </div>
        ))}
      </div>

      {/* MODAL CODE remains exactly the same... */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                <h3 className="text-lg font-bold mb-4">
                    {isAuditor && selectedItem.status === 'Pending Review' ? 'Verify Closure' : 'Submit Action Plan'}
                </h3>
                <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedItem.observation_text}</div>

                <form>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500">Root Cause Analysis</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows="2"
                                disabled={isAuditor} 
                                value={formData.root_cause} 
                                onChange={e => setFormData({...formData, root_cause: e.target.value})}
                            ></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500">Corrective Action</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows="2"
                                disabled={isAuditor}
                                value={formData.corrective_action} 
                                onChange={e => setFormData({...formData, corrective_action: e.target.value})}
                            ></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500">Target Date</label>
                            <input type="date" className="w-full border rounded p-2 text-sm"
                                disabled={isAuditor}
                                value={formData.target_date} 
                                onChange={e => setFormData({...formData, target_date: e.target.value})}
                            />
                        </div>
                    </div>

                    {isAuditor && (
                         <div className="mt-4 border-t pt-4">
                            <label className="block text-xs font-bold text-gray-500">Auditor Remarks</label>
                            <textarea className="w-full border rounded p-2 text-sm" placeholder="Reason for approval/rejection..."
                                value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})}
                            ></textarea>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setSelectedItem(null)} className="text-gray-500 px-3 py-2">Cancel</button>
                        
                        {!isAuditor && (
                            <button onClick={handleSubmitResponse} disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-300">
                                <Send size={16}/> {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                        )}

                        {isAuditor && (
                            <>
                                <button type="button" onClick={() => handleVerify('Reject')} disabled={submitting} className="bg-red-100 text-red-600 px-4 py-2 rounded font-bold hover:bg-red-200 flex items-center gap-2">
                                    <XCircle size={16}/> Reject
                                </button>
                                <button type="button" onClick={() => handleVerify('Approve')} disabled={submitting} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2">
                                    <Check size={16}/> Approve
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ActionItems;