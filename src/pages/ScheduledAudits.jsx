import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';

const ScheduledAudits = () => {
  const [schedules] = useState([
    { id: 101, area: "RVK Bangalore", planned_date: "2025-10-15", assigned: "Unassigned" },
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Scheduling</h1>
        <p className="text-gray-500 text-sm">Assign auditors and dates to approved plans.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-800 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-3">Audit ID</th>
              <th className="px-6 py-3">Location</th>
              <th className="px-6 py-3">Target Date</th>
              <th className="px-6 py-3">Auditor</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">#{item.id}</td>
                <td className="px-6 py-4">{item.area}</td>
                <td className="px-6 py-4">{item.planned_date}</td>
                <td className="px-6 py-4 italic text-gray-400">{item.assigned}</td>
                <td className="px-6 py-4 text-right">
                  <button className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 ml-auto">
                    <CalendarClock size={14} /> Schedule
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ScheduledAudits;