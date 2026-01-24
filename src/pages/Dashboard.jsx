import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckCircle, AlertTriangle, 
  FileText, TrendingUp, PieChart, Activity, MapPin, Loader, Layers, Calendar, Clock, AlertCircle, ArrowRight
} from 'lucide-react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom'; // Added for navigation

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook for navigation
  
  // 🟢 1. GET CURRENT USER
  const currentUser = JSON.parse(localStorage.getItem('user')) || { role: 'Guest', full_name: '', prakalpa_name: '' };
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Super Admin';

  const [stats, setStats] = useState({
    // Existing Stats
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
    prakalpaStats: [], 
    functionalStats: [],

    // 🟢 NEW METRICS
    pendingScheduleCount: 0,    // Audits status='Planned'
    scheduledCount: 0,          // Audits status='Scheduled' (ALL, including past)
    overdueNcCount: 0,          // Open NCs > 20 days old
    nextAudit: null,            // Next upcoming (or oldest pending) 'Scheduled' audit
    upcomingList: []            
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // --- STEP 1: FETCH PLANS (With Extra Date Fields) ---
      let planQuery = supabase
        .from('audit_plan')
        .select('audit_id, status, prakalpa_name, functional_area, coordinator_name, schedule_start_date, planned_date');

      // RBAC Filter
      if (!isAdmin) {
          const myName = currentUser.full_name || 'Unknown';
          const myLoc = currentUser.prakalpa_name || 'Unknown';
          planQuery = planQuery.or(`coordinator_name.eq.${myName},prakalpa_name.eq.${myLoc}`);
      }

      const { data: plans, error: planError } = await planQuery;
      if (planError) throw planError;

      // --- STEP 2: FETCH OBSERVATIONS (With created_at for Age Calculation) ---
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

      // --- STEP 3: CALCULATIONS ---

      // A. Existing Completion Metrics
      const totalAudits = plans.length;
      const completedAudits = plans.filter(p => p.status === 'Completed').length;
      const auditCompletionPct = totalAudits ? Math.round((completedAudits / totalAudits) * 100) : 0;

      // B. "To Schedule" Count
      const pendingScheduleCount = plans.filter(p => p.status === 'Planned').length;

      // C. 🟢 FIXED: "Scheduled" Logic (Include ALL scheduled, regardless of date)
      const scheduledAudits = plans
        .filter(p => p.status === 'Scheduled') // Filter by STATUS only
        .map(p => ({ ...p, dateObj: new Date(p.schedule_start_date || p.planned_date) }))
        .sort((a, b) => a.dateObj - b.dateObj); // Ascending (Oldest/Overdue first)

      const scheduledCount = scheduledAudits.length;
      const nextAudit = scheduledAudits.length > 0 ? scheduledAudits[0] : null;

      // D. Overdue (Aging) Logic
      const today = new Date();
      const overdueDateThreshold = new Date();
      overdueDateThreshold.setDate(today.getDate() - 20); // 20 days ago

      let totalNC = 0, closedNC = 0;
      let totalOFI = 0, closedOFI = 0;
      let overdueNcCount = 0;

      obs.forEach(o => {
          const t = (o.type || "").toLowerCase();
          const isClosed = o.status === 'Closed';
          const isNC = t.includes('non') || t.includes('nc') || t.includes('conformance');

          if (isNC) {
              totalNC++;
              if (isClosed) closedNC++;
              else {
                  // Check Age for OPEN items
                  const createdDate = new Date(o.created_at);
                  if (createdDate < overdueDateThreshold) {
                      overdueNcCount++;
                  }
              }
          } else if (t.includes('improvement') || t.includes('opportunity') || t.includes('ofi')) {
              totalOFI++;
              if (isClosed) closedOFI++;
          }
      });

      const ncClosurePct = totalNC ? Math.round((closedNC / totalNC) * 100) : 0;
      const ofiClosurePct = totalOFI ? Math.round((closedOFI / totalOFI) * 100) : 0;

      // E. Charts Data
      const locationMap = plans.reduce((acc, curr) => {
        const name = curr.prakalpa_name || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      
      const prakalpaStats = Object.entries(locationMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); 

      const funcMap = plans.reduce((acc, curr) => {
          const area = curr.functional_area || 'General'; // 🟢 Added Fallback
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
        prakalpaStats, functionalStats,
        
        // New State
        pendingScheduleCount,
        scheduledCount, // 🟢 Updated
        overdueNcCount,
        nextAudit,
        upcomingList: scheduledAudits.slice(0, 3) 
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
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-blue-600"/> 
            {isAdmin ? "Executive Dashboard" : `Dashboard: ${currentUser.full_name || 'My Overview'}`}
        </h1>
        <p className="text-sm text-gray-500">
            {isAdmin 
                ? "Real-time overview of organization-wide audit performance." 
                : `Tracking audits, compliance, and pending actions for ${currentUser.prakalpa_name || 'your assigned locations'}.`}
        </p>
      </div>

      {/* ACTION CENTER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. SCHEDULING ALERT (YELLOW) */}
          <div onClick={() => navigate('/planning')} className="bg-yellow-50 p-5 rounded-xl border border-yellow-200 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition">
             <div>
                <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">To Be Scheduled</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.pendingScheduleCount} <span className="text-base font-normal text-gray-500">Audits</span></h3>
                <p className="text-xs text-yellow-700 mt-1 font-medium">Pending from Planned List</p>
             </div>
             <div className="bg-white p-3 rounded-full text-yellow-600 shadow-sm border border-yellow-100">
                <Calendar size={24}/>
             </div>
          </div>

          {/* 2. OVERDUE RISK ALERT (RED) */}
          <div onClick={() => navigate('/action-items')} className="bg-red-50 p-5 rounded-xl border border-red-200 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition">
             <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Aging Issues (20+ Days)</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.overdueNcCount} <span className="text-base font-normal text-gray-500">Open NCs</span></h3>
                <p className="text-xs text-red-700 mt-1 font-medium">Approaching Deadline</p>
             </div>
             <div className="bg-white p-3 rounded-full text-red-600 shadow-sm border border-red-100">
                <AlertCircle size={24}/>
             </div>
          </div>

          {/* 3. SCHEDULED / EXECUTION QUEUE (BLUE) - 🟢 UPDATED */}
          <div onClick={() => navigate('/scheduled')} className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition min-h-[140px]">
             <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Scheduled (Pending)</p>
                    <h3 className="text-3xl font-bold text-gray-800">{stats.scheduledCount} <span className="text-base font-normal text-gray-500">Audits</span></h3>
                </div>
                <div className="bg-white p-3 rounded-full text-blue-600 shadow-sm border border-blue-100">
                   <Clock size={24}/>
                </div>
             </div>
             
             {/* Next Audit Detail */}
             {stats.nextAudit ? (
                 <div className="mt-2 pt-2 border-t border-blue-100">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-bold uppercase">Next Up:</span>
                        <span className="text-xs font-mono bg-white px-1 rounded text-gray-500">{new Date(stats.nextAudit.schedule_start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-700 truncate" title={stats.nextAudit.prakalpa_name}>
                        {stats.nextAudit.prakalpa_name}
                    </div>
                 </div>
             ) : (
                 <p className="text-xs text-gray-400 mt-2">No active schedules.</p>
             )}
          </div>
      </div>

      {/* --- ROW 2: STANDARD METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Audit Progress */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completion Rate</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.auditCompletionPct}%</h2>
                      <p className="text-sm text-gray-400 mt-1">{stats.completedAudits} / {stats.totalAudits} Done</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-full text-gray-600">
                      <Activity size={24} />
                  </div>
              </div>
              <div className="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${stats.auditCompletionPct}%` }}></div>
              </div>
          </div>

          {/* NC Closure */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">NC Resolution</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.ncClosurePct}%</h2>
                      <p className="text-sm text-gray-400 mt-1">{stats.closedNC} / {stats.totalNC} Closed</p>
                  </div>
                  <div className={`p-3 rounded-full ${stats.ncClosurePct > 50 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      <CheckCircle size={24} />
                  </div>
              </div>
              <div className="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stats.ncClosurePct > 50 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${stats.ncClosurePct}%` }}></div>
              </div>
          </div>

          {/* Pending Actions (Total) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Open Items</p>
                      <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.totalNC - stats.closedNC}</h2>
                      <p className="text-sm text-gray-400 mt-1">Pending Non-Conformances</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-full text-gray-500">
                      <AlertTriangle size={24} />
                  </div>
              </div>
          </div>
      </div>

      {/* --- ROW 3: DETAILED BREAKDOWNS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT: FUNCTIONAL AREA PERFORMANCE */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <Layers size={18} className="text-gray-400"/> Area Performance
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
                                      {area.completed} / {area.total} ({area.pct}%)
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
                  <strong>Insight:</strong> {stats.overdueNcCount > 0 ? 
                    <span className="text-red-600 font-bold">⚠️ Action Needed: {stats.overdueNcCount} items are older than 20 days.</span> : 
                    "You have " + (stats.totalNC - stats.closedNC) + " pending items requiring attention."
                  }
              </div>
          </div>

      </div>
    </div>
  );
};

export default Dashboard;