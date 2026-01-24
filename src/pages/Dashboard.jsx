import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckCircle, AlertTriangle, 
  TrendingUp, PieChart, Activity, Layers, Calendar, Clock, AlertCircle, Loader, BarChart2, Map, Target, ClipboardList
} from 'lucide-react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // 🟢 1. GET CURRENT USER
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  const [stats, setStats] = useState({
    // Core Metrics
    totalAudits: 0,
    completedAudits: 0,
    auditCompletionPct: 0,
    
    // Obs Metrics
    totalObs: 0, totalNC: 0, closedNC: 0, ncClosurePct: 0,
    totalOFI: 0, closedOFI: 0, ofiClosurePct: 0,
    
    // Dashboard Logic
    prakalpaStats: [], 
    functionalStats: [],
    pendingScheduleCount: 0,    
    scheduledCount: 0,          
    overdueCount: 0,            
    totalOpenItems: 0,          
    
    // Admin Metrics
    avgAuditsPerPrakalpa: 0,
    avgNCPerAudit: 0,       
    prakalpaCoveragePct: 0, 
    totalMasterPrakalpas: 0, 
    uniqueAuditedPrakalpas: 0, 
    
    auditsByType: [], 
    paretoData: []    
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. FETCH AUDIT PLANS (Includes Completion Date)
      let planQuery = supabase
        .from('audit_plan')
        .select('audit_id, status, prakalpa_name, functional_area, coordinator_name, schedule_start_date, planned_date, completion_date');

      if (!isAdmin) {
          const myName = currentUser.full_name || 'Unknown';
          const myLoc = currentUser.prakalpa_name || 'Unknown';
          planQuery = planQuery.or(`coordinator_name.eq.${myName},prakalpa_name.eq.${myLoc}`);
      }

      const { data: plans, error: planError } = await planQuery;
      if (planError) throw planError;

      // 2. FETCH OBSERVATIONS
      const visibleAuditIds = plans.map(p => p.audit_id);
      let obsQuery = supabase
        .from('audit_observations')
        .select('type, status, audit_id, created_at');
      
      if (visibleAuditIds.length > 0) {
          obsQuery = obsQuery.in('audit_id', visibleAuditIds);
      } else {
          obsQuery = obsQuery.eq('audit_id', 'NON_EXISTENT_ID');
      }

      const { data: obs, error: obsError } = await obsQuery;
      if (obsError) throw obsError;

      // 3. FETCH MASTER PRAKALPAS
      let prakalpaMap = {}; 
      let totalMasterPrakalpas = 0;

      if (isAdmin) {
          const { data: locs, error: masterError } = await supabase
            .from('master_prakalpas') 
            .select('prakalpa_name, prakalpa_type'); 
          
          if (!masterError && locs) {
              totalMasterPrakalpas = locs.length;
              locs.forEach(l => {
                  if (l.prakalpa_name) {
                      const cleanName = l.prakalpa_name.trim().toLowerCase();
                      prakalpaMap[cleanName] = l.prakalpa_type || 'Uncategorized';
                  }
              });
          }
      }

      // --- CALCULATIONS ---

      // A. Basic Counts
      const totalAudits = plans.length;
      const completedAudits = plans.filter(p => p.status === 'Completed').length;
      const auditCompletionPct = totalAudits ? Math.round((completedAudits / totalAudits) * 100) : 0;

      // B. Scheduling
      const pendingScheduleCount = plans.filter(p => p.status === 'Planned').length;
      const scheduledCount = plans.filter(p => p.status === 'Scheduled').length; 

      // C. Observations & Aging Logic
      const today = new Date();
      let totalNC = 0, closedNC = 0, totalOFI = 0, closedOFI = 0, overdueCount = 0;
      
      // Map Audit ID -> Completion Date & Prakalpa Name
      const auditMetaMap = plans.reduce((acc, p) => { 
          acc[p.audit_id] = {
              name: p.prakalpa_name,
              completionDate: p.completion_date ? new Date(p.completion_date) : null
          }; 
          return acc; 
      }, {});

      const openNcByPrakalpa = {}; 

      obs.forEach(o => {
          const t = (o.type || "").toLowerCase();
          const isClosed = o.status === 'Closed';
          
          const isNC = t.includes('non') || t.includes('nc') || t.includes('conformance');
          const isOFI = t.includes('improvement') || t.includes('ofi');

          if (isNC) {
              totalNC++;
              if (isClosed) closedNC++;
              else {
                  // 🟢 AGING LOGIC: Only count if Audit is Completed AND > 20 days since completion
                  const meta = auditMetaMap[o.audit_id];
                  if (meta && meta.completionDate) {
                      const ageInMillis = today - meta.completionDate;
                      const ageInDays = Math.floor(ageInMillis / (1000 * 60 * 60 * 24));
                      if (ageInDays > 20) overdueCount++;
                  }

                  // Pareto Data (Open NCs)
                  const pName = (meta && meta.name) ? meta.name : 'Unknown';
                  openNcByPrakalpa[pName] = (openNcByPrakalpa[pName] || 0) + 1;
              }
          } else if (isOFI) {
              totalOFI++;
              if (isClosed) closedOFI++;
          }
      });

      const ncClosurePct = totalNC ? Math.round((closedNC / totalNC) * 100) : 0;
      const ofiClosurePct = totalOFI ? Math.round((closedOFI / totalOFI) * 100) : 0;
      const totalOpenItems = (totalNC - closedNC) + (totalOFI - closedOFI);

      // D. METRICS CALCULATIONS
      let avgAuditsPerPrakalpa = 0;
      let avgNCPerAudit = 0;
      let prakalpaCoveragePct = 0;
      let uniqueAuditedPrakalpas = 0;
      let auditsByType = [];
      let paretoData = [];

      // 1. Avg NC per Audit
      if (completedAudits > 0) {
          avgNCPerAudit = (totalNC / completedAudits).toFixed(1);
      }

      if (isAdmin) {
          // 2. Type Analysis & Unique Counts
          const typeCounts = {};
          const uniquePrakalpasSet = new Set(); 

          plans.forEach(p => {
              const rawName = p.prakalpa_name || 'Unknown';
              const lookupKey = rawName.trim().toLowerCase(); 
              
              const pType = prakalpaMap[lookupKey] || 'Uncategorized';
              typeCounts[pType] = (typeCounts[pType] || 0) + 1;
              
              uniquePrakalpasSet.add(lookupKey); 
          });

          uniqueAuditedPrakalpas = uniquePrakalpasSet.size;

          // 3. Coverage %
          if (totalMasterPrakalpas > 0) {
              prakalpaCoveragePct = Math.round((uniqueAuditedPrakalpas / totalMasterPrakalpas) * 100);
          }

          // 4. Avg Audits per Prakalpa
          avgAuditsPerPrakalpa = uniqueAuditedPrakalpas ? (totalAudits / uniqueAuditedPrakalpas).toFixed(1) : 0;

          // 5. Transform for Charts
          auditsByType = Object.entries(typeCounts)
              .map(([type, count]) => ({ type, count }))
              .sort((a,b) => b.count - a.count);

          paretoData = Object.entries(openNcByPrakalpa)
              .map(([name, count]) => ({ name, count }))
              .sort((a,b) => b.count - a.count)
              .slice(0, 10);
      }

      // E. Functional Stats
      const funcMap = plans.reduce((acc, curr) => {
          const area = curr.functional_area || 'General';
          if (!acc[area]) acc[area] = { total: 0, completed: 0 };
          acc[area].total += 1;
          if (curr.status === 'Completed') acc[area].completed += 1;
          return acc;
      }, {});

      const functionalStats = Object.entries(funcMap).map(([name, data]) => ({
          name, total: data.total, completed: data.completed,
          pct: data.total ? Math.round((data.completed / data.total) * 100) : 0
      })).sort((a, b) => b.total - a.total); 

      setStats({
        totalAudits, completedAudits, auditCompletionPct,
        totalObs: obs.length, totalNC, closedNC, ncClosurePct,
        totalOFI, closedOFI, ofiClosurePct,
        functionalStats,
        pendingScheduleCount, scheduledCount, overdueCount, totalOpenItems,
        
        avgAuditsPerPrakalpa,
        avgNCPerAudit,
        prakalpaCoveragePct,
        totalMasterPrakalpas,
        uniqueAuditedPrakalpas,
        auditsByType,
        paretoData
      });

    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center text-gray-500"><Loader className="animate-spin mr-2"/> Loading Dashboard...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-blue-600"/> 
            {isAdmin ? "Executive Dashboard" : `Dashboard: ${currentUser.full_name || 'My Overview'}`}
        </h1>
        <p className="text-sm text-gray-500">
            {isAdmin ? "Organization-wide audit performance & strategic insights." : `Tracking compliance for ${currentUser.prakalpa_name || 'your locations'}.`}
        </p>
      </div>

      {/* ROW 1: ACTION ALERTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div onClick={() => navigate('/planning')} className="bg-yellow-50 p-5 rounded-xl border border-yellow-200 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition">
             <div>
                <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">To Be Scheduled</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.pendingScheduleCount} <span className="text-base font-normal text-gray-500">Audits</span></h3>
             </div>
             <div className="bg-white p-3 rounded-full text-yellow-600 shadow-sm border border-yellow-100"><Calendar size={24}/></div>
          </div>

          {/* Aging Items (Report Date Logic) */}
          <div onClick={() => navigate('/action-items')} className="bg-red-50 p-5 rounded-xl border border-red-200 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition">
             <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Aging Items (20+ Days)</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.overdueCount} <span className="text-base font-normal text-gray-500">NCs</span></h3>
                <p className="text-xs text-red-600 mt-1">Since Report Date</p>
             </div>
             <div className="bg-white p-3 rounded-full text-red-600 shadow-sm border border-red-100"><AlertCircle size={24}/></div>
          </div>

          <div onClick={() => navigate('/scheduled')} className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition min-h-[120px]">
             <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Scheduled (Pending)</p>
                    <h3 className="text-3xl font-bold text-gray-800">{stats.scheduledCount} <span className="text-base font-normal text-gray-500">Audits</span></h3>
                    <p className="text-xs text-blue-600 mt-1">Upcoming</p>
                </div>
                <div className="bg-white p-3 rounded-full text-blue-600 shadow-sm border border-blue-100"><Clock size={24}/></div>
             </div>
          </div>
      </div>

      {/* ROW 2: KPIS & METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completion Rate</p>
                  <Activity size={18} className="text-blue-500"/>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{stats.auditCompletionPct}%</h2>
              <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${stats.auditCompletionPct}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">{stats.completedAudits} / {stats.totalAudits} Done</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">NC Resolution</p>
                  <CheckCircle size={18} className="text-green-500"/>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{stats.ncClosurePct}%</h2>
              <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${stats.ncClosurePct > 50 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${stats.ncClosurePct}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">{stats.closedNC} / {stats.totalNC} Closed</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Open Items</p>
                  <AlertTriangle size={18} className="text-orange-500"/>
              </div>
              <h2 className="text-3xl font-bold text-orange-600">{stats.totalOpenItems}</h2>
              <p className="text-xs text-gray-400 mt-1">Pending NCs & OFIs</p>
          </div>

          {/* New Metric: Avg NCs Per Audit */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg NCs / Audit</p>
                  <ClipboardList size={18} className="text-purple-500"/>
              </div>
              <h2 className="text-3xl font-bold text-purple-700">{stats.avgNCPerAudit}</h2>
              <p className="text-xs text-gray-400 mt-1">Issue Density</p>
          </div>
      </div>

      {/* ROW 3: ADMIN STRATEGIC INSIGHTS */}
      {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Coverage Card */}
              <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100">
                  <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Audit Coverage</p>
                      <Map size={18} className="text-indigo-600"/>
                  </div>
                  <h2 className="text-3xl font-bold text-indigo-700 mt-2">{stats.prakalpaCoveragePct}%</h2>
                  <p className="text-xs text-indigo-600 mt-1">
                      {stats.uniqueAuditedPrakalpas} of {stats.totalMasterPrakalpas} Prakalpas Audited
                  </p>
              </div>

              <div className="bg-pink-50 p-6 rounded-xl shadow-sm border border-pink-100">
                  <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-pink-800 uppercase tracking-wider">Audit Intensity</p>
                      <Target size={18} className="text-pink-600"/>
                  </div>
                  <h2 className="text-3xl font-bold text-pink-700 mt-2">{stats.avgAuditsPerPrakalpa}</h2>
                  <p className="text-xs text-pink-600 mt-1">Avg. Audits per Location</p>
              </div>

              {/* Audits By Type Table */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                      <Layers size={14}/> Audits by Prakalpa Type
                  </h3>
                  <div className="overflow-hidden border rounded-lg max-h-32 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 uppercase font-bold text-gray-500 sticky top-0">
                              <tr>
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2 text-right">Count</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {stats.auditsByType.length === 0 ? (
                                  <tr><td colSpan="2" className="p-3 text-center text-gray-400">No data.</td></tr>
                              ) : (
                                  stats.auditsByType.map((row, i) => (
                                      <tr key={i} className="hover:bg-gray-50">
                                          <td className="px-3 py-1.5 font-medium text-gray-700 truncate max-w-[120px]" title={row.type}>{row.type}</td>
                                          <td className="px-3 py-1.5 text-right font-bold text-blue-600">{row.count}</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* ROW 4: PARETO CHART */}
      {isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
                  <BarChart2 size={18} className="text-red-600"/> Open Non-Conformances by Prakalpa (Pareto)
              </h3>
              <p className="text-xs text-gray-400 mb-6">Top locations contributing to pending compliance issues.</p>
              
              <div className="space-y-3">
                  {stats.paretoData.length === 0 ? (
                      <div className="text-center p-10 text-gray-400 bg-gray-50 rounded-lg">No open non-conformances found.</div>
                  ) : (
                      stats.paretoData.map((item, i) => {
                          const maxVal = stats.paretoData[0].count;
                          const widthPct = (item.count / maxVal) * 100;
                          
                          return (
                              <div key={i} className="flex items-center gap-4 group">
                                  <div className="w-48 text-xs font-bold text-gray-600 truncate text-right" title={item.name}>
                                      {item.name}
                                  </div>
                                  <div className="flex-1 h-5 bg-gray-100 rounded-r-full relative overflow-hidden">
                                      <div 
                                          className="h-full bg-red-500 rounded-r-full transition-all duration-1000 group-hover:bg-red-600" 
                                          style={{ width: `${widthPct}%` }}
                                      ></div>
                                  </div>
                                  <div className="w-8 text-xs font-bold text-red-700">{item.count}</div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>
      )}

      {/* 🟢 ROW 5: FUNCTIONAL AREA PERFORMANCE (Restored) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
              <Activity size={18} className="text-gray-400"/> Functional Area Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.functionalStats.slice(0, 6).map((area, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="flex justify-between text-xs mb-2">
                          <span className="font-bold text-gray-700 truncate w-3/4" title={area.name}>{area.name}</span>
                          <span className="text-gray-500">{area.pct}%</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-gray-200">
                          <div 
                              className={`h-full rounded-full ${area.pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                              style={{ width: `${area.pct}%` }}
                          ></div>
                      </div>
                  </div>
              ))}
          </div>
      </div>

    </div>
  );
};

export default Dashboard;