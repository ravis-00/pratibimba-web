import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckCircle, AlertTriangle, 
  FileText, TrendingUp, PieChart, Activity, MapPin, Loader, Layers
} from 'lucide-react';
import { supabase } from '../supabase';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAudits: 0,
    completedAudits: 0,
    auditCompletionPct: 0,
    
    totalObs: 0,
    totalNC: 0,
    closedNC: 0,
    ncClosurePct: 0,
    
    totalOFI: 0,
    closedOFI: 0,
    ofiClosurePct: 0,
    
    prakalpaStats: [], // { name: 'Yoga Kendra', count: 5 }
    functionalStats: [] // { name: 'IT', total: 10, completed: 8, pct: 80 }
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch All Plans (Now including functional_area)
      const { data: plans, error: planError } = await supabase
        .from('audit_plan')
        .select('audit_id, status, prakalpa_name, functional_area');
      
      if (planError) throw planError;

      // 2. Fetch All Observations
      const { data: obs, error: obsError } = await supabase
        .from('audit_observations')
        .select('type, status');

      if (obsError) throw obsError;

      // --- CALCULATIONS ---

      // A. Audit Progress (Overall)
      const totalAudits = plans.length;
      const completedAudits = plans.filter(p => p.status === 'Completed').length;
      const auditCompletionPct = totalAudits ? Math.round((completedAudits / totalAudits) * 100) : 0;

      // B. Prakalpa Breakdown (Top 5 Active Locations)
      const locationMap = plans.reduce((acc, curr) => {
        const name = curr.prakalpa_name || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      
      const prakalpaStats = Object.entries(locationMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 only

      // 🟢 C. Functional Area Performance (New)
      const funcMap = plans.reduce((acc, curr) => {
          const area = curr.functional_area || 'General';
          if (!acc[area]) acc[area] = { total: 0, completed: 0 };
          
          acc[area].total += 1;
          if (curr.status === 'Completed') acc[area].completed += 1;
          
          return acc;
      }, {});

      const functionalStats = Object.entries(funcMap).map(([name, data]) => ({
          name,
          total: data.total,
          completed: data.completed,
          pct: data.total ? Math.round((data.completed / data.total) * 100) : 0
      })).sort((a, b) => b.total - a.total); // Sort by busiest departments

      // D. Observations Logic (NC vs OFI)
      let totalNC = 0, closedNC = 0;
      let totalOFI = 0, closedOFI = 0;

      obs.forEach(o => {
          const t = (o.type || "").toLowerCase();
          const isClosed = o.status === 'Closed';

          if (t.includes('non') || t.includes('nc') || t.includes('conformance')) {
              totalNC++;
              if (isClosed) closedNC++;
          } else if (t.includes('improvement') || t.includes('opportunity') || t.includes('ofi')) {
              totalOFI++;
              if (isClosed) closedOFI++;
          }
      });

      const ncClosurePct = totalNC ? Math.round((closedNC / totalNC) * 100) : 0;
      const ofiClosurePct = totalOFI ? Math.round((closedOFI / totalOFI) * 100) : 0;

      setStats({
        totalAudits, completedAudits, auditCompletionPct,
        totalObs: obs.length,
        totalNC, closedNC, ncClosurePct,
        totalOFI, closedOFI, ofiClosurePct,
        prakalpaStats,
        functionalStats
      });

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center text-gray-500"><Loader className="animate-spin mr-2"/> Loading Dashboard...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-blue-600"/> Executive Dashboard
        </h1>
        <p className="text-sm text-gray-500">Real-time overview of audit performance and compliance.</p>
      </div>

      {/* --- ROW 1: AUDIT EXECUTION STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Completion Rate */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Completion</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.auditCompletionPct}%</h2>
                      <p className="text-sm text-gray-400 mt-1">{stats.completedAudits} / {stats.totalAudits} Audits Done</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                      <Activity size={24} />
                  </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${stats.auditCompletionPct}%` }}></div>
              </div>
          </div>

          {/* Card 2: NC Closure Rate (CRITICAL METRIC) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">NC Closure Rate</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.ncClosurePct}%</h2>
                      <p className="text-sm text-gray-400 mt-1">{stats.closedNC} / {stats.totalNC} Issues Resolved</p>
                  </div>
                  <div className={`p-3 rounded-full ${stats.ncClosurePct > 50 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      <CheckCircle size={24} />
                  </div>
              </div>
              <div className="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stats.ncClosurePct > 50 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${stats.ncClosurePct}%` }}></div>
              </div>
          </div>

          {/* Card 3: Total Findings Volume */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Findings</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.totalObs}</h2>
                      <div className="flex gap-3 mt-1 text-xs font-bold">
                          <span className="text-red-500">{stats.totalNC} NCs</span>
                          <span className="text-blue-500">{stats.totalOFI} Opportunities</span>
                      </div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                      <FileText size={24} />
                  </div>
              </div>
          </div>
      </div>

      {/* --- ROW 2: DETAILED BREAKDOWNS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 🟢 LEFT: FUNCTIONAL AREA PERFORMANCE (NEW) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <Layers size={18} className="text-gray-400"/> Functional Area Performance
              </h3>
              
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                  {stats.functionalStats.length === 0 ? (
                      <p className="text-gray-400 italic text-sm">No data available.</p>
                  ) : (
                      stats.functionalStats.map((area, i) => (
                          <div key={i}>
                              <div className="flex justify-between text-sm mb-1">
                                  <span className="font-bold text-gray-700 truncate w-1/2" title={area.name}>{area.name}</span>
                                  <span className="text-gray-500 text-xs font-medium">
                                      {area.completed} / {area.total} Audits ({area.pct}%)
                                  </span>
                              </div>
                              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full rounded-full ${area.pct === 100 ? 'bg-green-500' : area.pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`} 
                                      style={{ width: `${area.pct}%` }}
                                  ></div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* RIGHT: COMPLIANCE HEALTH (NC vs OFI) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <PieChart size={18} className="text-gray-400"/> Compliance Health
              </h3>
              
              <div className="space-y-6">
                  {/* NC Row */}
                  <div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-gray-700">Non-Conformances (Critical)</span>
                          <span className="text-gray-500">{stats.closedNC}/{stats.totalNC} Closed</span>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="flex-1 w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                              <div className="bg-red-500 h-full rounded-full" style={{ width: `${stats.ncClosurePct}%` }}></div>
                          </div>
                          <span className="text-sm font-bold text-red-600 w-10">{stats.ncClosurePct}%</span>
                      </div>
                  </div>

                  {/* OFI Row */}
                  <div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-gray-700">Opportunities for Improvement</span>
                          <span className="text-gray-500">{stats.closedOFI}/{stats.totalOFI} Closed</span>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="flex-1 w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{ width: `${stats.ofiClosurePct}%` }}></div>
                          </div>
                          <span className="text-sm font-bold text-blue-600 w-10">{stats.ofiClosurePct}%</span>
                      </div>
                  </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500">
                  <strong>Insight:</strong> You have {stats.totalNC - stats.closedNC} pending Non-Conformances that require immediate corrective action.
              </div>
          </div>

      </div>
    </div>
  );
};

export default Dashboard;