import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Search, CheckCircle, Save, User, ShieldCheck, Send, AlertCircle, History } from 'lucide-react';
import { supabase } from '../supabase';

const ActionItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [actionInputs, setActionInputs] = useState({});

  // 🟢 GET USER
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  const fetchActionItems = async () => {
    setLoading(true);
    try {
      // 1. Fetch Observations
      let query = supabase.from('audit_observations').select('*').order('created_at', { ascending: false });
      if (tab === 'open') query = query.neq('status', 'Closed'); 
      else query = query.eq('status', 'Closed');
      
      const { data: obsData, error } = await query;
      if (error) throw error;

      if (obsData && obsData.length > 0) {
          // 2. Fetch Plan Info
          const auditIds = [...new Set(obsData.map(item => item.audit_id))];
          const { data: planData } = await supabase.from('audit_plan').select('audit_id, prakalpa_name, coordinator_name').in('audit_id', auditIds);

          // Merge & Filter
          let merged = obsData.map(obs => {
              const plan = planData?.find(p => p.audit_id === obs.audit_id) || {};
              return { ...obs, audit_plan: plan };
          });

          // 🟢 RBAC
          if (!isAdmin) {
             merged = merged.filter(item => {
                 const isCoord = item.audit_plan.coordinator_name === currentUser.full_name;
                 const isLoc = (currentUser.prakalpa_name || '').trim() === (item.audit_plan.prakalpa_name || '').trim();
                 return isCoord || isLoc;
             });
          }
          setItems(merged);
      } else { setItems([]); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchActionItems(); }, [tab]);

  // HANDLERS
  const handleInputChange = (id, text) => {
    setActionInputs(prev => ({ ...prev, [id]: text }));
  };

  const handleSubmit = async (item) => {
      const uniqueKey = item.id || item.observation_id;
      if(!actionInputs[uniqueKey]) return alert("Please enter corrective action.");
      if(!window.confirm("Submit corrective action for verification?")) return;
      
      const { error } = await supabase.from('audit_observations')
        .update({ status: 'Pending Verification', corrective_action: actionInputs[uniqueKey] })
        .eq(item.id ? 'id' : 'observation_id', uniqueKey);
      
      if(!error) {
          alert("Submitted Successfully!");
          fetchActionItems();
      } else {
          alert("Error: " + error.message);
      }
  };

  const handleVerify = async (item) => {
      const uniqueKey = item.id || item.observation_id;
      if(!window.confirm("Verify and Close this finding?")) return;
      
      const { error } = await supabase.from('audit_observations')
        .update({ status: 'Closed' })
        .eq(item.id ? 'id' : 'observation_id', uniqueKey);
        
      if(!error) {
          alert("Closed Successfully!");
          fetchActionItems(); // Refresh to remove from list
      } else {
          alert("Error: " + error.message);
      }
  };

  const filtered = items.filter(i => (i.observation_text||'').toLowerCase().includes(searchTerm.toLowerCase()));

  // Helper for Badges
  const getTypeColor = (type) => {
      const t = (type || "").toLowerCase();
      if (t.includes('non') || t.includes('nc')) return 'bg-red-50 text-red-700 border-red-100';
      if (t.includes('improvement') || t.includes('ofi')) return 'bg-blue-50 text-blue-700 border-blue-100';
      return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CheckSquare className="text-purple-600" /> Action Items & CAPA</h1>
          <p className="text-sm text-gray-500 mt-1">{isAdmin ? "Track all pending NCs." : `Manage corrective actions for ${currentUser.prakalpa_name || currentUser.full_name}`}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setTab('open')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition ${tab==='open' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                <Clock size={16}/> To-Do ({tab==='open'?items.length:'...'})
            </button>
            <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition ${tab==='history' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                <History size={16}/> History
            </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
          <input type="text" placeholder="Search finding, ID, or location..." className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* CARDS LIST */}
      <div className="space-y-4">
          {!loading && filtered.length === 0 && <div className="text-center p-12 text-gray-400 border-2 border-dashed rounded-xl">No action items found.</div>}
          
          {filtered.map((item, i) => {
              const uniqueKey = item.id || item.observation_id || i;
              const isCoordinator = isAdmin || item.audit_plan?.coordinator_name === currentUser.full_name;
              
              return (
              <div key={uniqueKey} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                  
                  {/* 🟢 HEADER ROW: ID | Location | Finding ID | Type | Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                          {/* Audit ID */}
                          <span className="bg-gray-100 text-gray-600 font-mono text-xs font-bold px-2 py-1 rounded border border-gray-200">
                              {item.audit_id}
                          </span>
                          {/* Location */}
                          <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded border border-purple-100 uppercase">
                              {item.audit_plan?.prakalpa_name}
                          </span>
                          
                          {/* 🟢 FINDING ID */}
                          <span className="bg-blue-50 text-blue-700 font-mono text-xs font-bold px-2 py-1 rounded border border-blue-100">
                              {item.observation_id || 'ID-MISSING'}
                          </span>

                          {/* 🟢 FINDING TYPE (NC/OFI) */}
                          <span className={`text-xs font-bold px-2 py-1 rounded border ${getTypeColor(item.type)}`}>
                              {item.type || 'Non-Conformance'}
                          </span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                          {item.status === 'Pending Verification' ? (
                              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
                                  <Clock size={12}/> Pending Verification
                              </span>
                          ) : item.status === 'Closed' ? (
                              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center gap-1">
                                  <CheckCircle size={12}/> Closed
                              </span>
                          ) : (
                              <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">
                                  Action Required
                              </span>
                          )}
                      </div>
                  </div>

                  {/* FINDING CONTENT */}
                  <div className="mb-4">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">{item.functional_area || 'General'}</div>
                      <div className={`p-4 rounded-lg border relative ${item.type && item.type.includes('Improvement') ? 'bg-blue-50/50 border-blue-100' : 'bg-red-50/50 border-red-100'}`}>
                          <span className={`block text-[10px] font-bold uppercase mb-1 ${item.type && item.type.includes('Improvement') ? 'text-blue-800' : 'text-red-800'}`}>
                              Observation
                          </span>
                          <p className="text-sm text-gray-800 font-medium whitespace-pre-wrap">{item.observation_text}</p>
                      </div>
                  </div>

                  {/* ACTION WORKFLOW SECTION */}
                  {tab === 'open' ? (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          {item.status === 'Open' ? (
                              isCoordinator ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 italic"><User size={16}/> Waiting for Auditee submission...</div>
                              ) : (
                                  <>
                                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Your Corrective Action</label>
                                      <textarea 
                                          className="w-full border rounded p-2 text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                          rows="2" 
                                          placeholder="Describe action taken to resolve this..." 
                                          value={actionInputs[uniqueKey]||''} 
                                          onChange={e=>handleInputChange(uniqueKey, e.target.value)}
                                      />
                                      <div className="flex justify-end">
                                          <button 
                                              onClick={()=>handleSubmit(item)} 
                                              disabled={!actionInputs[uniqueKey]} 
                                              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition"
                                          >
                                              <Send size={16}/> Submit for Verification
                                          </button>
                                      </div>
                                  </>
                              )
                          ) : (
                              // Pending Verification State
                              <>
                                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Auditee Response</label>
                                  <div className="bg-white p-3 rounded border text-sm text-gray-800 mb-3 shadow-sm">{item.corrective_action}</div>
                                  {isCoordinator ? (
                                      <div className="flex justify-end">
                                          <button onClick={()=>handleVerify(item)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm transition">
                                              <ShieldCheck size={16}/> Verify & Close
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="text-sm text-orange-600 font-bold flex items-center gap-2"><Clock size={16}/> Submitted. Waiting for Auditor approval.</div>
                                  )}
                              </>
                          )}
                      </div>
                  ) : (
                      <div className="bg-green-50 p-3 rounded border border-green-100">
                          <span className="block text-xs font-bold text-green-800 uppercase mb-1">Closed Action</span>
                          <p className="text-sm text-green-900">{item.corrective_action}</p>
                      </div>
                  )}
              </div>
          )})}
      </div>
    </div>
  );
};
export default ActionItems;