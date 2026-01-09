import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Save, X } from 'lucide-react';

const MasterSettings = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Functional Area'); // Tabs for filtering
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', category: 'Functional Area', value: '', parent_value: '', display_order: 1, status: 'Active'
  });

  // ⚠️ Hardcoded URL for development
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'meta/dropdowns/list' })
      });
      const res = await response.json();
      if (res.status === 'success') setItems(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Filter items based on the selected Tab
  const filteredItems = items.filter(i => i.category === activeTab);

  // Helper: Get Pillars for Parent Dropdown
  const pillarOptions = items.filter(i => i.category === 'Functional Area');

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const action = isEditing ? 'meta/dropdowns/update' : 'meta/dropdowns/create';
    
    // If category is Functional Area, force parent to be empty
    const payload = { ...formData, category: activeTab };
    if (activeTab === 'Functional Area') payload.parent_value = ''; 

    try {
      await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) { alert("Error saving"); } finally { setLoading(false); }
  };

  const openEdit = (item) => {
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setIsEditing(false);
    setFormData({ id: '', category: activeTab, value: '', parent_value: '', display_order: filteredItems.length + 1, status: 'Active' });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <Settings className="text-gray-600" /> System Masters
      </h1>

      {/* TABS */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {['Functional Area', 'Audit Area', 'Location Type'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-lg">{activeTab} List</h2>
        <button onClick={openNew} className="bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm hover:bg-blue-700">
          <Plus size={16} /> Add New
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold">
            <tr>
              <th className="px-6 py-3">Value (Name)</th>
              {activeTab === 'Audit Area' && <th className="px-6 py-3">Parent Pillar</th>}
              <th className="px-6 py-3">Order</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">{item.value}</td>
                {activeTab === 'Audit Area' && (
                  <td className="px-6 py-3 text-gray-500">{item.parent_value || '-'}</td>
                )}
                <td className="px-6 py-3">{item.display_order}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.status==='Active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => openEdit(item)} className="text-blue-500 hover:bg-blue-100 p-1 rounded"><Edit size={14}/></button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-400">No records found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{isEditing ? 'Edit Item' : `Add ${activeTab}`}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Name / Value</label>
                <input required className="w-full border rounded px-3 py-2" value={formData.value} onChange={e=>setFormData({...formData, value: e.target.value})}/>
              </div>
              
              {/* Only show Parent Dropdown if we are creating an Audit Area */}
              {activeTab === 'Audit Area' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Parent Pillar</label>
                  <select className="w-full border rounded px-3 py-2" value={formData.parent_value} onChange={e=>setFormData({...formData, parent_value: e.target.value})}>
                    <option value="">-- Select Pillar --</option>
                    {pillarOptions.map((p,i) => <option key={i} value={p.value}>{p.value}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Order</label>
                  <input type="number" className="w-full border rounded px-3 py-2" value={formData.display_order} onChange={e=>setFormData({...formData, display_order: e.target.value})}/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
                  <select className="w-full border rounded px-3 py-2" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
              <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterSettings;