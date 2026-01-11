import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Plus, CheckCircle, AlertTriangle, Info, Save, ArrowLeft, ExternalLink } from 'lucide-react';
import config from '../config';

const AuditExecution = () => {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const API_URL = config.API_URL;
  const currentUser = JSON.parse(localStorage.getItem('user'));

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [observations, setObservations] = useState([]);
  const [selectedArea, setSelectedArea] = useState('General'); // Currently selected area filter
  
  // Form State
  const [newObs, setNewObs] = useState({ type: 'Non-Conformance', text: '' });

  useEffect(() => {
    fetchExecutionData();
  }, []);

  const fetchExecutionData = async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'audits/execution/get', userEmail: currentUser.email, audit_id: auditId })
      });
      const res = await response.json();
      if (res.status === 'success') {
        setPlan(res.data.plan);
        setChecklists(res.data.checklists);
        setObservations(res.data.observations);
        // Default to first audit area if available
        if(res.data.plan.audit_areas) {
            setSelectedArea(res.data.plan.audit_areas.split(',')[0].trim());
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAddObservation = async (e) => {
    e.preventDefault();
    if (!newObs.text) return;

    const payload = {
        audit_id: auditId,
        functional_area: selectedArea, // Link finding to current area
        type: newObs.type,
        observation_text: newObs.text
    };

    // Optimistic UI Update
    const tempId = Date.now();
    const tempObs = { ...payload, observation_id: tempId, status: 'Saving...' };
    setObservations([...observations, tempObs]);
    setNewObs({ type: 'Non-Conformance', text: '' });

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'audits/observation/save', userEmail: currentUser.email, ...payload })
    });
    fetchExecutionData(); // Refresh to get real ID
  };

  const handleFinalize = async () => {
      if(!window.confirm("Are you sure? This will lock the audit and notify auditees.")) return;
      await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'audits/finalize', userEmail: currentUser.email, audit_id: auditId }) // Pass auditee emails here if needed
      });
      alert("Audit Completed & Report Generated!");
      navigate('/scheduled-audits');
  };

  if (loading) return <div className="p-8 text-center">Loading Audit Workspace...</div>;
  if (!plan) return <div className="p-8 text-center text-red-500">Audit not found.</div>;

  // Filter lists based on selection
  const currentChecklist = checklists.find(c => c.functional_area === plan.functional_area); // Simple logic
  const currentObservations = observations.filter(o => o.functional_area === selectedArea);
  const auditAreasList = plan.audit_areas ? plan.audit_areas.split(',').map(s=>s.trim()) : ['General'];

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1 cursor-pointer hover:text-blue-600" onClick={() => navigate(-1)}>
                <ArrowLeft size={16}/> Back to Schedule
            </div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="text-purple-600"/> Execution: {plan.location_name} ({plan.audit_id})
            </h1>
        </div>
        <button onClick={handleFinalize} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md">
            Finalize & Submit Report
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: AREAS & CHECKLIST */}
        <div className="w-1/3 bg-white border-r flex flex-col">
            <div className="p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-700 text-sm uppercase mb-2">1. Audit Areas Scope</h3>
                <p className="text-xs text-gray-500 mb-4">Select an area to log findings.</p>
                {/* CHECKLIST BUTTON */}
                {currentChecklist ? (
                    <a href={currentChecklist.checklist_url} target="_blank" rel="noreferrer" 
                       className="flex items-center justify-center gap-2 w-full bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded hover:bg-blue-100 font-medium transition">
                       <ExternalLink size={16}/> Open {plan.functional_area} Checklist
                    </a>
                ) : (
                    <div className="text-xs text-orange-500 italic p-2 border border-orange-100 bg-orange-50 rounded">
                        No PDF checklist linked for {plan.functional_area} in Master.
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {auditAreasList.map(area => (
                    <div key={area} 
                         onClick={() => setSelectedArea(area)}
                         className={`p-3 rounded cursor-pointer border flex justify-between items-center ${selectedArea === area ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                        <span className={`font-medium ${selectedArea === area ? 'text-purple-800' : 'text-gray-600'}`}>{area}</span>
                        {/* Fake completion toggle for UI feel */}
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300"></div> 
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT MAIN: OBSERVATIONS */}
        <div className="w-2/3 flex flex-col bg-gray-50">
            <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-500"/> Findings for: <span className="text-purple-600 underline">{selectedArea}</span>
                </h3>

                {/* OBSERVATION LIST */}
                <div className="space-y-3 mb-6">
                    {currentObservations.length === 0 && (
                        <div className="text-center p-8 text-gray-400 border-2 border-dashed rounded-lg">
                            No observations recorded yet. Everything compliant?
                        </div>
                    )}
                    {currentObservations.map((obs, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 animate-fade-in">
                            <div className="flex justify-between mb-1">
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${obs.type.includes('Non') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {obs.type}
                                </span>
                                <span className="text-xs text-gray-400">{obs.status}</span>
                            </div>
                            <p className="text-gray-800 text-sm whitespace-pre-wrap">{obs.observation_text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ADD ENTRY FORM */}
            <div className="bg-white border-t p-6 shadow-lg z-10">
                <form onSubmit={handleAddObservation} className="space-y-3">
                    <div className="flex gap-4">
                        <select className="border rounded px-3 py-2 text-sm w-1/3" 
                            value={newObs.type} onChange={e => setNewObs({...newObs, type: e.target.value})}>
                            <option>Non-Conformance (Major)</option>
                            <option>Non-Conformance (Minor)</option>
                            <option>Opportunity for Improvement</option>
                            <option>Good Practice</option>
                        </select>
                        <input className="border rounded px-3 py-2 text-sm flex-1" 
                            placeholder="Describe the observation, evidence, or gap..." 
                            value={newObs.text} onChange={e => setNewObs({...newObs, text: e.target.value})}
                        />
                        <button className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 flex items-center gap-2">
                            <Plus size={18}/> Add
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuditExecution;