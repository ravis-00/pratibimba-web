import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, MapPin, User, Layers } from 'lucide-react';

const CreateAuditPlan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown Data State
  const [prakalpas, setPrakalpas] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [coordinators, setCoordinators] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    prakalpa_name: '',
    functional_area: '',
    coordinator_name: '',
    planned_date: '',
    status: 'Planned'
  });

  // 1. Fetch Dropdown Data on Load
  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        setLoading(true);

        // A. Fetch Prakalpas
        const { data: pData } = await supabase
          .from('master_prakalpas')
          .select('prakalpa_name')
          .order('prakalpa_name', { ascending: true });

        // B. Fetch Functional Areas (from master_dropdowns)
        const { data: fData } = await supabase
          .from('master_dropdowns')
          .select('value')
          .eq('category', 'Functional Area')
          .eq('status', 'Active')
          .order('display_order', { ascending: true });

        // C. Fetch Coordinators (from users)
        const { data: cData } = await supabase
          .from('users')
          .select('full_name')
          .eq('role', 'Audit Coordinator') 
          .eq('status', 'Active');

        setPrakalpas(pData || []);
        setFunctionalAreas(fData || []);
        setCoordinators(cData || []);
      } catch (error) {
        console.error("Error loading dropdowns:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDropdowns();
  }, []);

  // 2. Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Auto-generate Audit ID (e.g., IQAN25 + Random 4 digits)
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      const randomSeq = Math.floor(1000 + Math.random() * 9000); 
      const audit_id = `IQAN${yearSuffix}${randomSeq}`;

      const { error } = await supabase
        .from('audit_plans')
        .insert([{
          audit_id: audit_id,
          prakalpa_name: formData.prakalpa_name,
          functional_area: formData.functional_area,
          coordinator_name: formData.coordinator_name,
          planned_date: formData.planned_date,
          status: 'Planned' 
        }]);

      if (error) throw error;

      alert(`Success! Audit Plan Created: ${audit_id}`);
      navigate('/planning'); // Go back to list
    } catch (error) {
      alert("Error creating plan: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/planning')} 
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Create New Audit Plan</h1>
          <p className="text-sm text-gray-500">Define the scope, location, and timeline for a new audit.</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center gap-2">
          <Layers className="text-blue-600" size={20}/>
          <h2 className="font-bold text-blue-800">Audit Details</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Row 1: Prakalpa & Functional Area */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400"/> Prakalpa (Location)
              </label>
              <select 
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.prakalpa_name}
                onChange={e => setFormData({...formData, prakalpa_name: e.target.value})}
              >
                <option value="">-- Select Prakalpa --</option>
                {prakalpas.map((p, i) => (
                  <option key={i} value={p.prakalpa_name}>{p.prakalpa_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Layers size={16} className="text-gray-400"/> Functional Area
              </label>
              <select 
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.functional_area}
                onChange={e => setFormData({...formData, functional_area: e.target.value})}
              >
                <option value="">-- Select Area --</option>
                {functionalAreas.map((f, i) => (
                  <option key={i} value={f.value}>{f.value}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Coordinator & Date */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <User size={16} className="text-gray-400"/> Coordinator
              </label>
              <select 
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.coordinator_name}
                onChange={e => setFormData({...formData, coordinator_name: e.target.value})}
              >
                <option value="">-- Select Coordinator --</option>
                {coordinators.map((c, i) => (
                  <option key={i} value={c.full_name}>{c.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} className="text-gray-400"/> Planned Date
              </label>
              <input 
                required
                type="date"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.planned_date}
                onChange={e => setFormData({...formData, planned_date: e.target.value})}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/planning')}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
            >
              {submitting ? 'Creating...' : <><Save size={18}/> Create Plan</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateAuditPlan;