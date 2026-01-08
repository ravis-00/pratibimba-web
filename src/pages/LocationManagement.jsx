import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Edit, X } from 'lucide-react';

const LocationManagement = () => {
  // State for Data
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 🟢 Track Mode
  
  // Form State
  const [formData, setFormData] = useState({
    location_id: '', // Needed for updates
    location_name: '', 
    prakalpa_name: '', 
    pramukh_email: '', 
    senior_pramukh_email: '', 
    address: ''
  });

  // ⚠️ HARDCODED URL (To ensure it works immediately)
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  // 1. Fetch Locations
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'meta/locations', userEmail: 'admin@test.com' })
      });
      const result = await response.json();
      if (result.status === 'success') setLocations(result.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Open Modal for NEW Location
  const handleAddNew = () => {
    setIsEditing(false);
    setFormData({
      location_id: '', location_name: '', prakalpa_name: '', pramukh_email: '', senior_pramukh_email: '', address: ''
    });
    setIsModalOpen(true);
  };

  // 3. Open Modal for EDIT Location
  const handleEdit = (loc) => {
    setIsEditing(true);
    setFormData({
      location_id: loc.location_id, // Important: We need this ID to tell backend which row to update
      location_name: loc.location_name,
      prakalpa_name: loc.prakalpa_name,
      pramukh_email: loc.pramukh_email || '',
      senior_pramukh_email: loc.senior_pramukh_email || '',
      address: loc.address || ''
    });
    setIsModalOpen(true);
  };

  // 4. Handle Submit (Create OR Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // 🟢 Decide Action
    const actionType = isEditing ? 'admin/locations/update' : 'admin/locations/create';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: actionType,
          userEmail: 'admin@test.com',
          ...formData
        })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        alert(isEditing ? 'Location Updated!' : 'Location Added! ID: ' + result.data.location_id);
        setIsModalOpen(false);
        fetchLocations(); // Refresh table
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="text-green-600" /> Location Master
        </h1>
        <button 
          onClick={handleAddNew} 
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition shadow"
        >
          <Plus size={18} /> Add Location
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Prakalpa</th>
                <th className="px-6 py-4">Pramukh Email</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10">Loading locations...</td></tr>
              ) : locations.map((loc, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs">{loc.location_id}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{loc.location_name}</td>
                  <td className="px-6 py-4">{loc.prakalpa_name}</td>
                  <td className="px-6 py-4 text-gray-500">{loc.pramukh_email}</td>
                  <td className="px-6 py-4 text-right">
                    {/* 🟢 EDIT BUTTON */}
                    <button 
                      onClick={() => handleEdit(loc)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{isEditing ? 'Edit Location' : 'Add Location'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Show ID only if Editing (Read Only) */}
              {isEditing && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Location ID</label>
                  <input disabled value={formData.location_id} className="w-full border bg-gray-100 text-gray-500 rounded-lg px-3 py-2" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                <input required placeholder="e.g. RVK Bangalore" className="w-full border rounded-lg px-3 py-2"
                  value={formData.location_name} onChange={e => setFormData({...formData, location_name: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prakalpa Name</label>
                <input required placeholder="e.g. Education" className="w-full border rounded-lg px-3 py-2"
                  value={formData.prakalpa_name} onChange={e => setFormData({...formData, prakalpa_name: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pramukh Email</label>
                <input type="email" placeholder="manager@test.com" className="w-full border rounded-lg px-3 py-2"
                  value={formData.pramukh_email} onChange={e => setFormData({...formData, pramukh_email: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea rows="2" className="w-full border rounded-lg px-3 py-2"
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <button disabled={loading} type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition">
                {loading ? 'Saving...' : (isEditing ? 'Update Location' : 'Save Location')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;