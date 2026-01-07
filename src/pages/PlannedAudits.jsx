import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';

const PlannedAudits = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Planned Audits</h1>
        <Link to="/planning/new" className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
          <Plus size={16} /> Create New Plan
        </Link>
      </div>
      <div className="bg-white p-10 rounded shadow text-center text-gray-500">
        <p>List of Audit Plans will appear here.</p>
        <p className="text-sm mt-2">Example Action: <Link to="/planning/schedule/101" className="text-blue-600 underline">Schedule Audit #101</Link></p>
      </div>
    </div>
  );
};
export default PlannedAudits;