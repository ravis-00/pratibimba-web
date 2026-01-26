import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { FileText, Plus, CheckCircle, AlertTriangle, Info, Save, ArrowLeft, ChevronRight, X, Edit3, Trash2 } from 'lucide-react';
// 🟢 IMPORT THE NEW ID HELPER
import { normalizeAuditID } from '../utils/idHelper';

const AuditExecution = () => {
  const { auditId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [auditAreasList, setAuditAreasList] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  
  // Observations
  const [observations, setObservations] = useState([]);
  const [newObs, setNewObs] = useState({ type: 'Non-Conformance (Major)', text: '' });

  // Modal State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [editForm, setEditForm] = useState({ type: '', text: '' });

  // 1. Fetch Audit Details
  useEffect(() => {
    const fetchExecutionData = async () => {
      try {
        setLoading(true);
        // 🟢 SAFETY: Clean the ID from the URL before querying
        const cleanId = normalizeAuditID(auditId);

        const { data, error } = await supabase
          .from('audit_plan')
          .select('*')
          .eq('audit_id', cleanId)
          .single();

        if (error) throw error;

        setPlan(data);

        // Parse Areas
        if (data.audit_areas) {
            const areas = data.audit_areas.split(',').map(s => s.trim());
            setAuditAreasList(areas);
            if (areas.length > 0) setSelectedArea(areas[0]);
        } else {
            setAuditAreasList(['General']);
            setSelectedArea('General');
        }

      } catch (error) {
        console.error("Error fetching execution data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (auditId) fetchExecutionData();
  }, [auditId]);

  // 2. Add Observation (Local)
  const handleAddObservation = (e) => {
    e.preventDefault();
    if (!newObs.text.trim()) return;

    const newEntry = {
        id: Date.now(), // Temporary internal ID for React keys
        audit_id: auditId, // Will be cleaned on save
        functional_area: selectedArea,
        type: newObs.type,
        observation_text: newObs.text,
        status: 'Open'
    };

    setObservations([newEntry, ...observations]);
    setNewObs({ ...newObs, text: '' }); 
  };

  // 3. Edit Observation (In Modal)
  const startEditing = (obs) => {
      setEditingId(obs.id);
      setEditForm({ type: obs.type, text: obs.observation_text });
  };

  const saveEdit = (id) => {
      setObservations(prev => prev.map(obs => 
          obs.id === id ? { ...obs, type: editForm.type, observation_text: editForm.text } : obs
      ));
      setEditingId(null);
  };

  const deleteObservation = (id) => {
      if(window.confirm("Remove this finding?")) {
          setObservations(prev => prev.filter(obs => obs.id !== id));
      }
  };

  // 4. Finalize & Save to DB (HARDENED)
  const confirmFinalize = async () => {
      try {
          // 🟢 CRITICAL FIX: Normalize the Audit ID before saving
          // This ensures findings NEVER get attached to "IQAN25087(a)"
          const cleanAuditId = normalizeAuditID(auditId);

          // Prepare records for DB
          const recordsToInsert = observations.map(({ id, ...rest }, index) => ({
              ...rest,
              audit_id: cleanAuditId, // 🔒 Force Clean Link
              // Generate standard ID: IQAN25087-OBS-01
              observation_id: `${cleanAuditId}-OBS-${String(index + 1).padStart(2, '0')}`
          }));

          // A. Save Observations FIRST
          if (recordsToInsert.length > 0) {
              const { error: obsError } = await supabase
                  .from('audit_observations')
                  .insert(recordsToInsert);
              
              if (obsError) {
                  console.error("Supabase Insert Error:", obsError);
                  alert(`❌ Failed to save findings!\n\nDatabase Error: ${obsError.message}`);
                  return; // Stop here
              }
          }

          // B. Update Audit Status
          const { error } = await supabase
            .from('audit_plan')
            .update({ status: 'Completed', completion_date: new Date() })
            .eq('audit_id', cleanAuditId); // 🔒 Update the clean ID record

          if (error) throw error;

          alert("Audit Finalized Successfully!");
          navigate('/reports/open'); // Updated to match your route

      } catch (e) {
          alert("Unexpected Error: " + e.message);
      }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Audit Workspace...</div>;
  if (!plan) return <div className="p-8 text-center text-red-500 font-bold">Audit not found.</div>;

  const currentObservations = observations.filter(o => o.functional_area === selectedArea);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
            <div 
              className="flex items-center gap-2 text-gray-500 text-sm mb-1 cursor-pointer hover:text-blue-600" 
              onClick={() => navigate('/scheduled')} 
            >
              <ArrowLeft size={16}/> Back to Schedule
            </div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="text-purple-600"/> Execution: {plan.prakalpa_name} ({plan.audit_id})
            </h1>
        </div>
        <button 
            onClick={() => setIsReviewOpen(true)} 
            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center gap-2"
        >
            <CheckCircle size={18}/> Finalize & Submit
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-1/3 bg-white border-r flex flex-col">
            <div className="p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-700 text-sm uppercase mb-2">1. Audit Areas Scope</h3>
                <p className="text-xs text-gray-500 mb-4">Select an area to log findings.</p>
                <div className="text-xs text-orange-500 italic p-2 border border-orange-100 bg-orange-50 rounded flex items-center gap-2">
                    <Info size={14}/> No PDF checklist linked for {plan.functional_area}.
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {auditAreasList.map(area => (
                    <div key={area} onClick={() => setSelectedArea(area)} className={`p-3 rounded cursor-pointer border flex justify-between items-center transition ${selectedArea === area ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                        <span className={`font-medium text-sm ${selectedArea === area ? 'text-purple-800' : 'text-gray-600'}`}>{area}</span>
                        {selectedArea === area && <ChevronRight size={16} className="text-purple-600"/>}
                    </div>
                ))}
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="w-2/3 flex flex-col bg-gray-50">
            <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-500"/> Findings for: <span className="text-purple-600 underline">{selectedArea}</span>
                </h3>
                <div className="space-y-3 mb-6">
                    {currentObservations.length === 0 && (
                        <div className="text-center p-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">No observations recorded yet.</div>
                    )}
                    {currentObservations.map((obs) => (
                        <div key={obs.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
                            <div className="flex justify-between mb-1">
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${obs.type.includes('Non') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{obs.type}</span>
                                <span className="text-xs text-gray-400">Draft</span>
                            </div>
                            <p className="text-gray-800 text-sm whitespace-pre-wrap mt-2">{obs.observation_text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* INPUT FORM */}
            <div className="bg-white border-t p-6 shadow-lg z-10">
                <form onSubmit={handleAddObservation} className="space-y-3">
                    <div className="flex gap-3">
                        <select className="border rounded-lg px-3 py-2 text-sm w-1/3 outline-none focus:ring-2 focus:ring-purple-500" value={newObs.type} onChange={e => setNewObs({...newObs, type: e.target.value})}>
                            <option>Non-Conformance (Major)</option>
                            <option>Non-Conformance (Minor)</option>
                            <option>Opportunity for Improvement</option>
                            <option>Good Practice</option>
                        </select>
                        <input className="border rounded-lg px-4 py-2 text-sm flex-1 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Describe the observation..." value={newObs.text} onChange={e => setNewObs({...newObs, text: e.target.value})} />
                        <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm transition"><Plus size={18}/> Add</button>
                    </div>
                </form>
            </div>
        </div>
      </div>

      {/* REVIEW & FINALIZE MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><CheckCircle className="text-green-600"/> Review Findings & Finalize</h3>
                    <button onClick={() => setIsReviewOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {observations.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 bg-white border border-dashed rounded-lg">
                            No observations recorded. Are you sure you want to finalize with 0 findings?
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {observations.map((obs) => (
                                <div key={obs.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    {editingId === obs.id ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400 uppercase">{obs.functional_area}</span>
                                            </div>
                                            <select className="w-full border p-2 rounded text-sm mb-2" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                                                <option>Non-Conformance (Major)</option>
                                                <option>Non-Conformance (Minor)</option>
                                                <option>Opportunity for Improvement</option>
                                                <option>Good Practice</option>
                                            </select>
                                            <textarea className="w-full border p-2 rounded text-sm h-24" value={editForm.text} onChange={e => setEditForm({...editForm, text: e.target.value})} />
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setEditingId(null)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Cancel</button>
                                                <button onClick={() => saveEdit(obs.id)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded">{obs.functional_area}</span>
                                                    <span className={`text-xs font-bold ${obs.type.includes('Non') ? 'text-red-600' : 'text-blue-600'}`}>{obs.type}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{obs.observation_text}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => startEditing(obs)} className="text-gray-400 hover:text-blue-600 p-1"><Edit3 size={16}/></button>
                                                <button onClick={() => deleteObservation(obs.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-white flex justify-end gap-3">
                    <button onClick={() => setIsReviewOpen(false)} className="px-5 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50">Keep Auditing</button>
                    <button onClick={confirmFinalize} className="px-5 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow flex items-center gap-2">
                        <Save size={18}/> Confirm & Finalize
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AuditExecution;