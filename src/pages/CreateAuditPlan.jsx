import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, MapPin, User, Layers, Info } from 'lucide-react';

const CreateAuditPlan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown Data
  const [prakalpas, setPrakalpas] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [coordinators, setCoordinators] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    prakalpa_name: '',
    functional_area: '',
    coordinator_name: '',
    planned_date: new Date().toISOString().split('T')[0], // Default to today
    status: 'Planned'
  });

  // Load Dropdowns
  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        setLoading(true);
        const { data: pData } = await supabase.from('master_prakalpas').select('prakalpa_name').order('prakalpa_name', { ascending: true });
        const { data: fData } = await supabase.from('master_dropdowns').select('value').eq('category', 'Functional Area').eq('status', 'Active').order('display_order', { ascending: true });
        const { data: cData } = await supabase.from('users').select('full_name').eq('role', 'Audit Coordinator').eq('status', 'Active');

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

  // 🟢 LOGIC: Calculate Financial Year & Prefix from Date
  const getFinancialYearDetails = (dateString) => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0=Jan, 11=Dec

    // Financial Year starts April 1st.
    // If Month is Jan(0), Feb(1), Mar(2) -> It belongs to Previous Year's cycle.
    const startYear = month < 3 ? year - 1 : year;
    const endYearShort = (startYear + 1).toString().slice(-2);
    
    return {
      ay_year: `${startYear}-${endYearShort}`, // e.g., "2025-26"
      id_prefix: `IQAN${startYear.toString().slice(-2)}` // e.g., "IQAN25"
    };
  };

  // 🟢 LOGIC: Generate Next Sequence ID
  const generateNextAuditId = async (dateString) => {
    const { id_prefix } = getFinancialYearDetails(dateString); // Get IQAN25
    
    // Find the last ID used in this series
    const { data, error } = await supabase
      .from('audit_plan')
      .select('audit_id')
      .ilike('audit_id', `${id_prefix}%`) // Look for IQAN25...
      .order('audit_id', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNum = 1; // Default start
    if (data && data.length > 0) {
      // Extract number: IQAN25152 -> 152
      const lastId = data[0].audit_id;
      const numPart = lastId.replace(id_prefix, ''); 
      const lastNum = parseInt(numPart, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    // Return IQAN25 + 153 (Padded to 3 digits)
    return `${id_prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Calculate details based on selected Planned Date
      const { ay_year } = getFinancialYearDetails(formData.planned_date);
      const audit_id = await generateNextAuditId(formData.planned_date);

      // 2. Insert into DB
      const { error } = await supabase
        .from('audit_plan')
        .insert([{
          audit_id: audit_id,
          ay_year: ay_year, // Saving the Year column
          prakalpa_name: formData.prakalpa_name,
          functional_area: formData.functional_area,
          coordinator_name: formData.coordinator_name,
          planned_date: formData.planned_date,
          status: 'Planned'
        }]);

      if (error) throw error;

      alert(`Success! Created Plan ${audit_id} for AY ${ay_year}`);
      navigate('/planning');
    } catch (error) {
      alert("Error creating plan: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentFY = getFinancialYearDetails(formData.planned_date).ay_year;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/planning')} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft className="text-gray-600" /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Create New Audit Plan</h1>
          <p className="text-sm text-gray-500">Define the scope, location, and timeline.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={20}/>
            <h2 className="font-bold text-blue-800">Audit Details</h2>
          </div>
          {/* Visual Indicator of FY */}
          <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded font-bold border border-blue-300">
            FY: {currentFY}
          </span>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Prakalpa (Location)</label>
              <select required className="w-full border p-2.5 rounded-lg bg-white" value={formData.prakalpa_name} onChange={e => setFormData({...formData, prakalpa_name: e.target.value})}>
                <option value="">-- Select Prakalpa --</option>
                {prakalpas.map((p, i) => <option key={i} value={p.prakalpa_name}>{p.prakalpa_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Functional Area</label>
              <select required className="w-full border p-2.5 rounded-lg bg-white" value={formData.functional_area} onChange={e => setFormData({...formData, functional_area: e.target.value})}>
                <option value="">-- Select Area --</option>
                {functionalAreas.map((f, i) => <option key={i} value={f.value}>{f.value}</option>)}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Coordinator</label>
              <select required className="w-full border p-2.5 rounded-lg bg-white" value={formData.coordinator_name} onChange={e => setFormData({...formData, coordinator_name: e.target.value})}>
                <option value="">-- Select Coordinator --</option>
                {coordinators.map((c, i) => <option key={i} value={c.full_name}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Planned Date</label>
              <input required type="date" className="w-full border p-2.5 rounded-lg" value={formData.planned_date} onChange={e => setFormData({...formData, planned_date: e.target.value})} />
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Info size={12}/> Determines ID Sequence (IQAN25...)</p>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/planning')} className="px-6 py-2.5 border rounded-lg hover:bg-gray-50 font-bold text-gray-600">Cancel</button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2">
              {submitting ? 'Creating...' : <><Save size={18}/> Create Plan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAuditPlan;