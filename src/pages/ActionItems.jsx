import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Search, CheckCircle, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

const ActionItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open'); // 'open' or 'history'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Local state to track input for each item
  const [actionInputs, setActionInputs] = useState({});

  // 🟢 1. GET CURRENT USER DETAILS
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  useEffect(() => {
    fetchActionItems();
  }, [tab]);

  const fetchActionItems = async () => {
    try {
      setLoading(true);

      // STEP 1: Fetch Observations
      let query = supabase
        .from('audit_observations')
        .select('*')
        .order('created_at', { ascending: false });

      if (tab === 'open') {
          query = query.neq('status', 'Closed'); 
      } else {
          query = query.eq('status', 'Closed');
      }

      const { data: obsData, error: obsError } = await query;
      if (obsError) throw obsError;

      // STEP 2: Manually fetch location details to check ownership
      if (obsData && obsData.length > 0) {
          const auditIds = [...new Set(obsData.map(item => item.audit_id))];
          const { data: planData, error: planError } = await supabase
              .from('audit_plan')
              .select('audit_id, prakalpa_name, coordinator_name')
              .in('audit_id', auditIds);

          if (planError) throw planError;

          // Merge Data
          let mergedData = obsData.map(obs => {
              const planInfo = planData.find(p => p.audit_id === obs.audit_id);
              return { 
                  ...obs, 
                  audit_plan: planInfo || { prakalpa_name: 'Unknown Location', coordinator_name: 'N/A' } 
              };
          });

          // 🟢 3. RBAC FILTERING
          if (!isAdmin) {
             mergedData = mergedData.filter(item => {
                 // User can see the item IF:
                 // A. They are the Coordinator for that specific audit
                 const isCoordinator = item.audit_plan.coordinator_name === currentUser.full_name;
                 
                 // B. OR They belong to that Prakalpa (Location) - e.g. An Auditee at "Yoga Kendra"
                 const userLoc = (currentUser.prakalpa_name || '').trim().toLowerCase();
                 const itemLoc = (item.audit_plan.prakalpa_name || '').trim().toLowerCase();
                 const isLocationUser = userLoc && itemLoc === userLoc;
                 
                 return isCoordinator || isLocationUser;
             });
          }

          // Filter for Non-Conformances Only
          const finalData = mergedData.filter(item => {
              const type = (item.type || "").toLowerCase();
              return type.includes('non') || type.includes('nc') || type.includes('conformance');
          });

          setItems(finalData);
      } else {
          setItems([]);
      }

    } catch (error) {
      console.error("Error fetching actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (id, text) => {
    setActionInputs(prev => ({ ...prev, [id]: text }));
  };

  const handleMarkDone = async (item) => {
      // Use unique ID (observation_id or database id)
      const uniqueKey = item.id || item.observation_id;
      const actionText = actionInputs[uniqueKey];

      if (!actionText || actionText.trim().length < 3) {
          alert("Please describe the Corrective Action taken before closing.");
          return;
      }

      if(!window.confirm("Confirm closing this CAPA?")) return;

      try {
          // Save the Resolution Text & Mark Closed
          const { error } = await supabase
            .from('audit_observations')
            .update({ 
                status: 'Closed',
                corrective_action: actionText 
            })
            // Try matching by ID first, fallback to observation_id if needed
            .eq(item.id ? 'id' : 'observation_id', uniqueKey);
          
          if(error) throw error;
          
          setItems(prev => prev.filter(i => (i.id || i.observation_id) !== uniqueKey));
          setActionInputs(prev => { const n = {...prev}; delete n[uniqueKey]; return n; }); // Cleanup
          alert("Action Item Closed Successfully!");
      } catch(e) {
          alert("Error closing item: " + e.message);
      }
  };

  const filteredItems = items.filter(item => 
    (item.observation_text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.audit_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.audit_plan?.prakalpa_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckSquare className="text-purple-600" /> My Action Items (CAPA)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
             {isAdmin ? "Track and close all Non-Conformances." : `Action items for ${currentUser.full_name}`}
          </p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg border shadow-sm">
            <button 
                onClick={() => setTab('open')} 
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${tab==='open' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Clock size={16}/> To-Do ({tab==='open' ? items.length : '...'})
            </button>
            <button 
                onClick={() => setTab('history')} 
                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${tab==='history' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <CheckCircle size={16}/> History
            </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-6">
          <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Search by Audit ID, Location, or Finding..." 
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-purple-100 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      {/* LIST */}
      <div className="space-y-4">
          {loading && <div className="text-center p-10 text-gray-500">Loading...</div>}
          
          {!loading && filteredItems.length === 0 && (
              <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <p className="text-gray-400 font-medium">No items found.</p>
              </div>
          )}

          {!loading && filteredItems.map((item, index) => {
              // Ensure we have a unique key for React
              const uniqueKey = item.id || item.observation_id || index;
              
              return (
              <div key={uniqueKey} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition group">
                  <div className="flex flex-col gap-4">
                      
                      {/* Top Row: Meta Data */}
                      <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded" title="Audit ID">{item.audit_id}</span>
                              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded uppercase">{item.audit_plan?.prakalpa_name || 'Unknown'}</span>
                              <span className="text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded font-bold">Non-Conformance</span>
                          </div>
                          {tab === 'history' && (
                             <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-100 text-xs">
                                <CheckCircle size={14}/> CLOSED
                             </span>
                          )}
                      </div>

                      {/* Middle: The Finding & OBSERVATION ID */}
                      <div>
                        <h3 className="text-gray-800 font-bold text-sm mb-1">{item.functional_area}</h3>
                        
                        {/* Red Finding Box */}
                        <div className="bg-red-50 p-3 rounded border border-red-100">
                            {/* Header inside the box for ID and Label */}
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-red-800 uppercase">Finding</span>
                                
                                {/* Observation ID Badge */}
                                <span className="font-mono text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm" title="Observation ID">
                                    {item.observation_id || "ID Missing"}
                                </span>
                            </div>
                            
                            {/* The Text */}
                            <p className="text-gray-800 text-sm mt-1">
                                {item.observation_text}
                            </p>
                        </div>
                      </div>

                      {/* Bottom: Action Taken Section */}
                      {tab === 'open' ? (
                          <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Corrective Action Required</label>
                              <textarea 
                                className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                rows="2"
                                placeholder="Describe what action was taken to resolve this issue..."
                                value={actionInputs[uniqueKey] || ''}
                                onChange={(e) => handleInputChange(uniqueKey, e.target.value)}
                              ></textarea>
                              <div className="mt-3 flex justify-end">
                                  <button 
                                    onClick={() => handleMarkDone(item)}
                                    className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-green-700 flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!actionInputs[uniqueKey]}
                                  >
                                      <Save size={16}/> Save & Close
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="mt-2 p-3 bg-green-50 rounded border border-green-100">
                              <span className="block text-xs font-bold text-green-800 uppercase mb-1">✅ Resolution / Corrective Action:</span>
                              <p className="text-sm text-green-900">
                                  {item.corrective_action || "No details recorded."}
                              </p>
                          </div>
                      )}

                  </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ActionItems;