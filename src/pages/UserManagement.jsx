import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, UserCheck, X } from 'lucide-react';

const UserManagement = () => {
  // State for Data
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]); // 🟢 Store locations for dropdown
  const [loading, setLoading] = useState(true);
  
  // State for UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 🟢 Track Mode (Add vs Edit)
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '', email: '', role: 'Auditee', prakalpa: '', phone_number: '', password: 'password123', status: 'Active'
  });

  // ⚠️ HARDCODED URL (To bypass .env issues for now)
  const API_URL = "https://script.google.com/macros/s/AKfycbydpsKTfB6uN8wYknoQMGntXDwmggXQdfmLGdfSHUxoS9ktImYk8oxcw_X-IE_HtGeoFA/exec";

  // 1. Fetch Data on Load
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Users
      const userRes = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'admin/users/list', userEmail: 'admin@test.com' })
      });
      const userData = await userRes.json();
      
      // Fetch Locations (for Prakalpa Dropdown)
      const locRes = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'meta/locations', userEmail: 'admin@test.com' })
      });
      const locData = await locRes.json();

      if (userData.status === 'success') setUsers(userData.data);
      if (locData.status === 'success') setLocations(locData.data);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 Helper: Get Unique Prakalpa Names for Dropdown
  const uniquePrakalpas = [...new Set(locations.map(l => l.prakalpa_name).filter(Boolean))];

  // 2. Open Modal for NEW User
  const handleAddNew = () => {
    setIsEditing(false); // Set to "Create Mode"
    setFormData({
      full_name: '', email: '', role: 'Auditee', prakalpa: '', phone_number: '', password: 'password123', status: 'Active'
    });
    setIsModalOpen(true);
  };

  // 3. Open Modal for EDIT User
  const handleEdit = (user) => {
    setIsEditing(true); // Set to "Edit Mode"
    setFormData({
      full_name: user.full_name,
      email: user.email, // Email is the ID, so we keep it
      role: user.role,
      prakalpa: user.prakalpa || '', // Handle nulls
      phone_number: user.phone_number || '',
      password: user.password || '', 
      status: user.status || 'Active'
    });
    setIsModalOpen(true);
  };

  // 4. Handle Submit (Create OR Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // 🟢 Decide Action based on Mode
    const actionType = isEditing ? 'admin/users/update' : 'admin/users/create';

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
        alert(isEditing ? 'User Updated Successfully!' : 'User Created Successfully!');
        setIsModalOpen(false);
        fetchData(); // Refresh table
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Network Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <UserCheck className="text-blue-600" /> User Management
        </h1>
        <button 
          onClick={handleAddNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow"
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Prakalpa</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-10">Loading users...</td></tr>
              ) : users.map((user, index) => (
                <tr key={index} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'Auditor' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">{user.prakalpa || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {/* 🟢 EDIT BUTTON NOW WORKS */}
                    <button 
                      onClick={() => handleEdit(user)}
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              {/* 🟢 DYNAMIC TITLE */}
              <h3 className="font-bold text-lg">{isEditing ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required type="text" className="w-full border rounded-lg px-3 py-2" 
                  value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  required 
                  type="email" 
                  // 🟢 DISABLE EMAIL IF EDITING (Cannot change ID)
                  disabled={isEditing}
                  className={`w-full border rounded-lg px-3 py-2 ${isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select className="w-full border rounded-lg px-3 py-2 bg-white"
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option>Admin</option>
                    <option>Audit Coordinator</option>
                    <option>Auditee</option>
                    <option>Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 bg-white"
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prakalpa (Project)</label>
                
                {/* 🟢 NEW DROPDOWN LOGIC */}
                <select 
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={formData.prakalpa} 
                  onChange={e => setFormData({...formData, prakalpa: e.target.value})}
                >
                  <option value="">-- Select Prakalpa --</option>
                  {uniquePrakalpas.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Populated from Location Master</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" 
                  value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
              </div>

              <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                {loading ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;