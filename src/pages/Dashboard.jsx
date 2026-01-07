import React from 'react';

const Dashboard = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="bg-blue-50 p-6 rounded-full mb-4">
        <span className="text-4xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-800">Dashboard Coming Soon</h2>
      <p className="text-gray-500 max-w-md mt-2">
        We are focusing on the Audit Planning & Scheduling workflows first. 
        Analytics will appear here once data is collected.
      </p>
    </div>
  );
};
export default Dashboard;