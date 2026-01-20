import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Edit, X, Save, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabase'; // ✅ Import Supabase

const LocationManagement = () => {
  const [prakalpas, setPrakalpas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    prakalpa_id: '', 
    prakalpa_name: '', 
    prakalpa_type: '', 
    place: '', 
    pramukh_email: '', 
    applicable_areas: [] 
  });

  // ✅ Hardcoded options for now (Replace with DB fetch later if needed)
  const typeOptions = [
    "Yoga Kendra", "School", "Slum Development", "Health Center", "Vocational Training"
  ];
  
  const areaOptions = [
    "Administration", "Finance", "HR", "Operations", "IT", "Marketing"
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // ✅ Fetch directly from Supabase
      const { data, error } = await supabase
        .from('master_prakalpas')
        .select('*')
        .order('prakalpa_id', { ascending: true });

      if (error) throw error;
      setPrakalpas(data || []); 
    } catch (e) { 
      console.error("Fetch Error:", e); 
      alert("Error loading data: " + e.message);
    } finally { 
      setLoading(false); 
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      // ✅ Delete from Supabase
      const { error } = await supabase
        .from('master_prakalpas')
        .delete()
        .eq('prakalpa_id', id);

      if (error) throw error;

      // Refresh local list without refetching everything
      setPrakalpas(prev => prev.filter(item => item.prakalpa_id !== id));
      alert("Record deleted successfully.");
    } catch (error) {
      console.error("Delete Error:", error);
      alert("Error deleting record: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleArea = (area) => {
    setFormData(prev => {
      const current = prev.applicable_areas || [];
      if (current.includes(area)) {
        return { ...prev, applicable_areas: current.filter(a => a !== area) };
      } else {
        return { ...prev, applicable_areas: [...current, area] };
      }
    });
  };

  const handleAddNew = () => {
    setIsEditing(false);
    // Generate a temporary ID or let user input it? 
    // For now, let's leave ID empty for user to type, or auto-generate if your DB handles it.
    setFormData({ 
      prakalpa_id: '', 
      prakalpa_name: '', 
      prakalpa_type: '', 
      place: '', 
      pramukh_email: '', 
      applicable_areas: [] 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (row) => {
    setIsEditing(true);
    setFormData({
      prakalpa_id: row.prakalpa_id,
      prakalpa_name: row.prakalpa_name,
      prakalpa_type: row.prakalpa_type,
      place: row.place,
      pramukh_email: row.pramukh_email || '', // Handle nulls
      // Convert comma-separated string back to array for the form
      applicable_areas: row.applicable_areas ? row.applicable_areas.split(',').map(s => s.trim()) : []
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Prepare payload (Convert array back to string for Text column)
    const payload = { 
      prakalpa_name: formData.prakalpa_name,
      prakalpa_type: formData.prakalpa_type,
      place: formData.place,
      pramukh_email: formData.pramukh_email,
      applicable_areas: formData.applicable_areas.join(', ')
    };

    try {
      if (isEditing) {
        // ✅ UPDATE
        const { error } = await supabase
          .from('master_prakalpas')
          .update(payload)
          .eq('prakalpa_id', formData.prakalpa_id);
        
        if (error) throw error;
      } else {
        // ✅ CREATE
        // Ensure ID is provided for new records
        if (!formData.prakalpa_id) throw new Error("Prakalpa ID is required.");
        
        const { error } = await supabase
          .from('master_prakalpas')
          .insert([{ ...payload, prakalpa_id: formData.prakalpa_id }]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData(); // Refresh list to show changes
      alert(isEditing ? "Updated successfully!" : "Added successfully!");
    } catch (error) { 
      console.error("Save Error:", error);
      alert("Error saving: " + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  // Filter Logic
  const filteredPrakalpas = prakalpas.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (p.prakalpa_name || '').toLowerCase().includes(searchLower) ||
      (p.place || '').toLowerCase().includes(searchLower) ||
      (p.prakalpa_id || '').toLowerCase().includes(searchLower) ||
      (p.prakalpa_type || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="text-green-600" /> Prakalpa Master
        </h1>
        
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Search..." 
               className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>

           <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded" title="Refresh">
             <RefreshCw size={20} />
           </button>
           <button onClick={handleAddNew} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow whitespace-nowrap">
             <Plus size={18} /> Add Prakalpa
           </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Prakalpa Name</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Place</th>
              <th className="px-6 py-4">Areas</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan="6" className="p-6 text-center text-gray-500">Loading data...</td></tr>}
            
            {!loading && filteredPrakalpas.length === 0 && (
               <tr><td colSpan="6" className="p-6 text-center text-gray-500">
                 {searchTerm ? 'No matching records found.' : 'No Prakalpas found.'}
               </td></tr>
            )}

            {!loading && filteredPrakalpas.map((row) => (
              <tr key={row.prakalpa_id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono text-xs text-gray-400">{row.prakalpa_id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{row.prakalpa_name}</td>
                <td className="px-6 py-4"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{row.prakalpa_type}</span></td>
                <td className="px-6 py-4">{row.place}</td>
                <td className="px-6 py-4 text-xs max-w-xs truncate" title={row.applicable_areas}>{row.applicable_areas}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => handleEdit(row)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition" title="Edit">
                    <Edit size={16}/>
                  </button>
                  <button onClick={() => handleDelete(row.prakalpa_id, row.prakalpa_name)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Delete">
                    <Trash2 size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">{isEditing ? 'Edit Prakalpa' : 'Add New Prakalpa'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              
              {/* ID Field - Editable only when adding new */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Prakalpa ID</label>
                <input 
                  required 
                  disabled={isEditing} // Cannot change ID once created
                  className={`w-full border border-gray-300 rounded px-3 py-2 ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  value={formData.prakalpa_id} 
                  onChange={e => setFormData({...formData, prakalpa_id: e.target.value})} 
                  placeholder="e.g. PRK001"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Prakalpa Name</label>
                <input required className="w-full border border-gray-300 rounded px-3 py-2" value={formData.prakalpa_name} onChange={e => setFormData({...formData, prakalpa_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Type</label>
                  <select required className="w-full border border-gray-300 rounded px-3 py-2 bg-white" value={formData.prakalpa_type} onChange={e => setFormData({...formData, prakalpa_type: e.target.value})}>
                    <option value="">-- Select Type --</option>
                    {typeOptions.map((t,i) => <option key={i} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Place / City</label>
                  <input required className="w-full border border-gray-300 rounded px-3 py-2" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Pramukh Email</label>
                <input type="email" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.pramukh_email} onChange={e => setFormData({...formData, pramukh_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Applicable Areas</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                  {areaOptions.map((area, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition">
                      <input 
                        type="checkbox" 
                        checked={formData.applicable_areas.includes(area)} 
                        onChange={() => toggleArea(area)} 
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      {area}
                    </label>
                  ))}
                </div>
              </div>
              <button disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex justify-center gap-2 shadow-lg">
                <Save size={18} /> {loading ? 'Saving...' : 'Save Prakalpa'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;