import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, FileText, Send, XCircle, Check } from 'lucide-react';
import config from '../config';

const ActionItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null); // For Modal
  const [formData, setFormData] = useState({ root_cause: '', corrective_action: '', target_date: '', remarks: '' });
  
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
    // Pre-fill if editing
    setFormData({
        root_cause: item.root_cause || '',
        corrective_action: item.corrective_action || '',
        target_date: item.target_date || '',
        remarks: ''
    });
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'capa/submit', 
            observation_id: selectedItem.observation_id,
            ...formData 
        })
    });
    setSelectedItem(null);
    fetchItems();
  };

  const handleVerify = async (decision) => {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'capa/verify', 
            observation_id: selectedItem.observation_id,
            decision: decision, // 'Approve' or 'Reject'
            remarks: formData.remarks
        })
    });
    setSelectedItem(null);
    fetchItems();
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
      if(status === 'Pending Review') return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center gap-1"><Clock size={12}/> Review Needed</span>;
      if(status === 'Open') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center gap-1"><AlertTriangle size={12}/> Action Required</span>;
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{status}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <CheckCircle className="text-purple-600"/> My Action Items (CAPA)
      </h1>

      {/* LIST OF OPEN ISSUES */}
      <div className="grid gap-4">
        {loading && <p>Loading actions...</p>}
        {!loading && items.length === 0 && <p className="text-gray-500 italic">No pending actions. Good job!</p>}
        
        {items.map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500 flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-gray-500 text-sm">{item.finding_code || item.observation_id}</span>
                        {getStatusBadge(item.status)}
                        <span className="text-xs text-gray-400">Audit: {item.audit_id} ({item.location_name})</span>
                    </div>
                    <p className="text-gray-800 font-medium mb-1">{item.observation_text}</p>
                    <p className="text-xs text-gray-500">Area: {item.functional_area} | Type: {item.type}</p>
                    
                    {/* Show response if exists */}
                    {item.root_cause && (
                        <div className="mt-3 bg-gray-50 p-2 rounded text-sm text-gray-600 border border-gray-100">
                            <strong>Root Cause:</strong> {item.root_cause} <br/>
                            <strong>Action:</strong> {item.corrective_action} (Target: {item.target_date})
                        </div>
                    )}
                </div>

                <div className="ml-4 flex flex-col gap-2">
                    {/* BUTTON LOGIC UPDATE:
                       1. RESPOND: Visible if status is OPEN and user is (Auditee OR Admin)
                       2. VERIFY: Visible if status is PENDING and user is (Coordinator OR Admin)
                    */}

                    {/* 🟢 1. RESPOND BUTTON */}
                    {/* Allow Admins to see this button too for testing */}
                    { (currentUser.role === 'Admin' || !isAuditor) && item.status === 'Open' && (
                        <button onClick={() => openModal(item)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 whitespace-nowrap">
                            Respond
                        </button>
                    )}

                    {/* 🟢 2. VERIFY BUTTON */}
                    { isAuditor && item.status === 'Pending Review' && (
                        <button onClick={() => openModal(item)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 whitespace-nowrap">
                            Verify Closure
                        </button>
                    )}

                    {/* 🟢 3. WAITING STATE */}
                    { !isAuditor && item.status === 'Pending Review' && (
                        <span className="text-xs text-orange-500 italic font-medium px-2 py-1 bg-orange-50 rounded border border-orange-100">
                            Waiting for Auditor...
                        </span>
                    )}
                </div>
            </div>
        ))}
      </div>

      {/* MODAL: Handles BOTH Auditee Response & Auditor Verification */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                <h3 className="text-lg font-bold mb-4">
                    {isAuditor ? 'Verify Closure' : 'Submit Action Plan'}
                </h3>
                
                <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedItem.observation_text}
                </div>

                <form>
                    {/* AUDITEE FIELDS */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500">Root Cause Analysis</label>
                            <textarea className="w-full border rounded p-2 text-sm" rows="2"
                                disabled={isAuditor} // Auditor can't edit this
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

                    {/* AUDITOR FIELDS */}
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
                            <button onClick={handleSubmitResponse} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2">
                                <Send size={16}/> Submit
                            </button>
                        )}

                        {isAuditor && (
                            <>
                                <button type="button" onClick={() => handleVerify('Reject')} className="bg-red-100 text-red-600 px-4 py-2 rounded font-bold hover:bg-red-200 flex items-center gap-2">
                                    <XCircle size={16}/> Reject
                                </button>
                                <button type="button" onClick={() => handleVerify('Approve')} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2">
                                    <Check size={16}/> Approve & Close
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