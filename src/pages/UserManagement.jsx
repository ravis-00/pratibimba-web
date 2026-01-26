import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, UserCheck, X } from 'lucide-react';
import { supabase } from '../supabase'; 

const UserManagement = () => {
  // State
  const [users, setUsers] = useState([]);
  const [prakalpaOptions, setPrakalpaOptions] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    original_email: null, // 🟢 ADDED: To track which user we are editing
    full_name: '', 
    email: '', 
    role: 'Auditee', 
    prakalpa_name: '', 
    phone_number: '', 
    password: 'password123', 
    status: 'Active'
  });

  // 1. Fetch Data on Load
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // A. Fetch Users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });

      if (userError) throw userError;
      setUsers(userData || []);

      // B. Fetch Prakalpas (for Dropdown)
      const { data: prakalpaData, error: locError } = await supabase
        .from('master_prakalpas')
        .select('prakalpa_name')
        .order('prakalpa_name', { ascending: true });

      if (locError) throw locError;

      const uniqueNames = [...new Set(prakalpaData.map(item => item.prakalpa_name))];
      setPrakalpaOptions(uniqueNames);

    } catch (error) {
      console.error("Error loading data:", error);
      alert("Error loading data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Delete (Updated to use Email)
  const handleDelete = async (email, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      setLoading(true);
      // 🟢 FIX: Delete by email, not id
      const { error } = await supabase.from('users').delete().eq('email', email);
      if (error) throw error;
      
      // Remove from local state
      setUsers(users.filter(u => u.email !== email));
      alert("User deleted successfully.");
    } catch (error) {
      alert("Error deleting: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Open Modal for NEW User
  const handleAddNew = () => {
    setIsEditing(false);
    setFormData({
      original_email: null,
      full_name: '', 
      email: '', 
      role: 'Auditee', 
      prakalpa_name: '', 
      phone_number: '', 
      password: 'password123', 
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  // 4. Open Modal for EDIT User
  const handleEdit = (user) => {
    setIsEditing(true);
    setFormData({
      original_email: user.email, // 🟢 STORE ORIGINAL EMAIL for Lookup
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      prakalpa_name: user.prakalpa_name || '', 
      phone_number: user.phone_number || '',
      password: user.password || '', 
      status: user.status || 'Active'
    });
    setIsModalOpen(true);
  };

  // 5. Handle Submit (Create OR Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role,
      prakalpa_name: formData.prakalpa_name,
      phone_number: formData.phone_number,
      password: formData.password,
      status: formData.status
    };

    try {
      if (isEditing) {
        // UPDATE
        // 🟢 FIX: Update using 'original_email' as the lookup key
        const { error } = await supabase
          .from('users')
          .update(payload)
          .eq('email', formData.original_email);

        if (error) throw error;
        alert('User Updated Successfully!');
      } else {
        // CREATE
        const { error } = await supabase
          .from('users')
          .insert([payload]);

        if (error) throw error;
        alert('User Created Successfully!');
      }

      setIsModalOpen(false);
      fetchData(); 
    } catch (error) {
      console.error("Save error:", error);
      alert('Error saving: ' + error.message);
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
              ) : users.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10">No users found.</td></tr>
              ) : (
                users.map((user, index) => (
                  // Using email as key since id might be missing
                  <tr key={user.email || index} className="hover:bg-gray-50 transition">
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
                    
                    <td className="px-6 py-4">{user.prakalpa_name || '-'}</td>
                    
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(user)} className="text-blue-500 hover:bg-blue-50 p-2 rounded" title="Edit">
                        <Edit size={16} />
                      </button>
                      {/* 🟢 FIX: Pass email instead of id */}
                      <button onClick={() => handleDelete(user.email, user.full_name)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
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
                <input required type="email" className="w-full border rounded-lg px-3 py-2"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
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
                <select 
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={formData.prakalpa_name} 
                  onChange={e => setFormData({...formData, prakalpa_name: e.target.value})}
                >
                  <option value="">-- Select Prakalpa --</option>
                  {prakalpaOptions.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>
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