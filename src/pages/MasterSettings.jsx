import React, { useState, useEffect } from 'react';
import { Plus, Settings, Edit, Trash2, X, RefreshCw } from 'lucide-react';

const MasterSettings = () => {
  // 1. STATE MANAGEMENT
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Functional Area');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // 🟢 STANDARDIZED FORM STATE (Matches DB 'parent_value')
  const [formData, setFormData] = useState({
    id: '',
    category: '',
    value: '',
    parent_value: '', 
    display_order: 1,
    status: 'Active'
  });

  // ⚠️ USE YOUR LATEST DEPLOYED URL
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  const getUserEmail = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr).email : null;
  };

  // 2. FETCH DATA
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const email = getUserEmail();
    if (!email) return;

    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'meta/dropdowns/list', userEmail: email })
      });
      const data = await res.json();
      if (data.status === 'success') {
        // Sort: Display Order ascending
        const sorted = (data.data || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        setItems(sorted);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. DERIVED LISTS
  // Used for the "Parent" dropdown
  const functionalAreas = items.filter(i => i.category === 'Functional Area' && i.status === 'Active');
  // Used for the Table Display
  const currentTabItems = items.filter(i => i.category === activeTab);

  // 4. HANDLERS
  const handleAddNew = () => {
    setIsEditing(false);
    setFormData({ 
      id: '', 
      category: activeTab, 
      value: '', 
      parent_value: '', 
      display_order: currentTabItems.length + 1, 
      status: 'Active' 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  // 🟢 RESTORED: Soft Delete (Deactivate)
  const handleSoftDelete = async (item) => {
    if(!window.confirm(`Are you sure you want to deactivate "${item.value}"?`)) return;
    
    setLoading(true);
    const email = getUserEmail();
    
    try {
      // We don't delete row, just set status to Inactive
      await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'meta/dropdowns/update', 
          userEmail: email, 
          id: item.id,
          status: 'Inactive' 
        })
      });
      fetchData(); 
    } catch (error) { 
      alert("Error updating status."); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = getUserEmail();
    setLoading(true);
    
    const action = isEditing ? 'meta/dropdowns/update' : 'meta/dropdowns/create';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, userEmail: email, ...formData })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
         setIsModalOpen(false);
         fetchData();
      } else {
         alert("Error: " + result.message); 
      }
    } catch (error) { 
      alert("Network Error saving."); 
    } finally { 
      setLoading(false); 
    }
  };

  // 5. TABS CONFIGURATION
  const tabs = [
    { name: 'Functional Area', label: '1. Functional Areas (Parent)' },
    { name: 'Audit Area', label: '2. Audit Areas (Child)' },
    { name: 'Prakalpa Type', label: '3. Prakalpa Types' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-blue-600" /> System Masters
        </h1>
        <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-100 rounded" title="Refresh">
          <RefreshCw size={20} />
        </button>
      </div>

      {/* TABS */}
      <div className="flex space-x-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.name
                ? 'bg-white text-blue-600 border-x border-t border-gray-200 shadow-sm relative top-[1px]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-700">{activeTab} List</h3>
          <button onClick={handleAddNew} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
            <Plus size={16} /> Add New
          </button>
        </div>

        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b">
            <tr>
              <th className="px-6 py-3">Value (Name)</th>
              {/* 🟢 CONDITIONAL COLUMN: Only show Parent for Audit Areas */}
              {activeTab === 'Audit Area' && <th className="px-6 py-3">Belongs To (Parent)</th>}
              <th className="px-6 py-3 w-24 text-center">Order</th>
              <th className="px-6 py-3 w-32">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="5" className="p-6 text-center">Loading...</td></tr> : 
             currentTabItems.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-gray-400">No items found.</td></tr> :
             currentTabItems.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">{item.value}</td>
                
                {activeTab === 'Audit Area' && (
                  <td className="px-6 py-3 text-blue-600 font-medium">
                    {item.parent_value || <span className="text-red-300 italic">Unmapped</span>}
                  </td>
                )}
                
                <td className="px-6 py-3 text-center text-gray-400">{item.display_order}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right flex justify-end gap-2">
                  <button onClick={() => handleEdit(item)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit size={16}/></button>
                  <button onClick={() => handleSoftDelete(item)} className="text-red-400 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {isEditing ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* 🟢 CONDITIONAL INPUT: PARENT CATEGORY */}
              {activeTab === 'Audit Area' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Belongs To (Functional Area)</label>
                  <select 
                    required 
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.parent_value}
                    onChange={(e) => setFormData({...formData, parent_value: e.target.value})}
                  >
                    <option value="">-- Select Parent Functional Area --</option>
                    {functionalAreas.map((fa, idx) => (
                      <option key={idx} value={fa.value}>{fa.value}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Name / Value</label>
                <input 
                  required 
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Display Order</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={formData.display_order}
                    onChange={(e) => setFormData({...formData, display_order: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Status</label>
                  <select 
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterSettings;