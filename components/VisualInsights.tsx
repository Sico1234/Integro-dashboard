'use client';

import { useFirebase } from "@/components/FirebaseProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, ClipboardList, Send, DollarSign, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function VisualInsights() {
  const { cases, agents } = useFirebase();

  const stats = useMemo(() => {
    // 1. Agent wise count and pending tasks
    const agentStatsMap: Record<string, { name: string, total: number, pending: number }> = {};
    
    // Initialize with all agents
    agents.forEach(a => {
      agentStatsMap[a.name] = { name: a.name, total: 0, pending: 0 };
    });
    // Add "Unassigned"
    agentStatsMap['Unassigned'] = { name: 'Unassigned', total: 0, pending: 0 };

    // 2. Arbitration status wise count
    const arbStatusMap: Record<string, { name: string, value: number }> = {};

    // 3. Dispatch status agent wise
    const agentDispatchMap: Record<string, { name: string, Pending: number, Dispatched: number, Hold: number, Closed: number }> = {};
    agents.forEach(a => {
      agentDispatchMap[a.name] = { name: a.name, Pending: 0, Dispatched: 0, Hold: 0, Closed: 0 };
    });
    agentDispatchMap['Unassigned'] = { name: 'Unassigned', Pending: 0, Dispatched: 0, Hold: 0, Closed: 0 };

    // 4. Agent wise dispatched cases total TOS
    const agentTOSMap: Record<string, { name: string, totalTOS: number }> = {};
    agents.forEach(a => {
      agentTOSMap[a.name] = { name: a.name, totalTOS: 0 };
    });
    agentTOSMap['Unassigned'] = { name: 'Unassigned', totalTOS: 0 };

    // 5. Month wise cases by company
    const monthCompanyMap: Record<string, any> = {};
    const companiesSet = new Set<string>();

    cases.forEach(c => {
      const agentName = c.assignedTo || 'Unassigned';
      const status = c.dispatchStatus || 'Pending';
      const arbStatus = c.arbitrationStatus || 'Not Specified';

      // Agent stats
      if (agentStatsMap[agentName]) {
        agentStatsMap[agentName].total++;
        if (status === 'Pending') {
          agentStatsMap[agentName].pending++;
        }
      }

      // Arb stats
      if (!arbStatusMap[arbStatus]) {
        arbStatusMap[arbStatus] = { name: arbStatus, value: 0 };
      }
      arbStatusMap[arbStatus].value++;

      // Dispatch agent wise
      if (agentDispatchMap[agentName]) {
        if (status === 'Closed') agentDispatchMap[agentName].Closed++;
        else if (status === 'Dispatched') agentDispatchMap[agentName].Dispatched++;
        else if (status === 'Hold') agentDispatchMap[agentName].Hold++;
        else agentDispatchMap[agentName].Pending++;
      }

      // TOS stats
      if (status === 'Dispatched' && agentTOSMap[agentName]) {
        const tos = parseFloat(String(c.tos || '0').replace(/,/g, '')) || 0;
        agentTOSMap[agentName].totalTOS += tos;
      }

      // Month stats by company
      if (c.receivedDate) {
        const dateObj = c.receivedDate.toDate ? c.receivedDate.toDate() : new Date(c.receivedDate);
        if (!isNaN(dateObj.getTime())) {
          const monthYear = dateObj.toLocaleDateString('default', { month: 'short', year: 'numeric' });
          const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          const company = (c.company || 'Unknown') && c.company.trim() ? c.company.trim() : 'Unknown';

          if (!monthCompanyMap[sortKey]) {
            monthCompanyMap[sortKey] = { month: monthYear, sortKey };
          }
          if (!monthCompanyMap[sortKey][company]) {
            monthCompanyMap[sortKey][company] = 0;
          }
          monthCompanyMap[sortKey][company]++;
          companiesSet.add(company);
        }
      }
    });

    const monthCompanyStats = Object.values(monthCompanyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      agentStats: Object.values(agentStatsMap).filter(a => a.total > 0),
      arbStats: Object.values(arbStatusMap),
      dispatchStats: Object.values(agentDispatchMap).filter(a => (a.Pending + a.Dispatched + a.Hold + a.Closed) > 0),
      tosStats: Object.values(agentTOSMap).filter(a => a.totalTOS > 0),
      monthCompanyStats,
      companiesList: Array.from(companiesSet)
    };
  }, [cases, agents]);

  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "ml-4 gap-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group")}>
        <BarChart3 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-slate-700">Visual Insights</span>
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-[1600px] h-[94vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white rounded-t-lg shrink-0">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <DialogTitle className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-blue-400" />
                Operational Intelligence
              </DialogTitle>
              <p className="text-slate-400 text-sm">Real-time data visualization and agent performance metrics.</p>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <div className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold mb-1">Total Cases</div>
              <div className="text-4xl font-mono font-bold leading-none">{cases.length}</div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full h-full space-y-6 flex flex-col">
            <TabsList className="flex flex-wrap shrink-0 w-full h-auto p-1 bg-slate-200/50 backdrop-blur-sm rounded-xl">              <TabsTrigger value="overview" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-[120px]">
                <Users className="h-4 w-4 mr-2" /> Agent Load
              </TabsTrigger>
              <TabsTrigger value="arbitration" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-[120px]">
                <ClipboardList className="h-4 w-4 mr-2" /> Arbitration
              </TabsTrigger>
              <TabsTrigger value="dispatch" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-[120px]">
                <Send className="h-4 w-4 mr-2" /> Dispatch Dept
              </TabsTrigger>
              <TabsTrigger value="financial" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-[120px]">
                <DollarSign className="h-4 w-4 mr-2" /> TOS Analysis
              </TabsTrigger>
              <TabsTrigger value="company_trends" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm min-w-[120px]">
                <Building2 className="h-4 w-4 mr-2" /> Company Trends
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 min-h-[500px]">
              <div className="grid gap-6 md:grid-cols-2 h-full">
                <Card className="border-none shadow-sm overflow-hidden flex flex-col">
                  <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                    <div>
                      <CardTitle className="text-lg">Agent Distribution</CardTitle>
                      <CardDescription>Total vs Pending cases per agent</CardDescription>
                    </div>
                    <Users className="h-5 w-5 text-slate-400" />
                  </CardHeader>
                  <CardContent className="pt-6 flex-1 min-h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.agentStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        <Bar 
                          name="Total Cases" 
                          dataKey="total" 
                          fill="#3b82f6" 
                          radius={[4, 4, 0, 0]} 
                          barSize={30}
                        />
                        <Bar 
                          name="Pending Tasks" 
                          dataKey="pending" 
                          fill="#ef4444" 
                          radius={[4, 4, 0, 0]} 
                          barSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden flex flex-col">
                  <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                    <div>
                      <CardTitle className="text-lg">Load Intensity</CardTitle>
                      <CardDescription>Agent capacity and backlog view</CardDescription>
                    </div>
                    <TrendingUp className="h-5 w-5 text-slate-400" />
                  </CardHeader>
                  <CardContent className="pt-6 flex-1 min-h-[400px]">                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.agentStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#3b82f6" 
                          strokeWidth={3} 
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="pending" 
                          stroke="#ef4444" 
                          strokeWidth={3} 
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="arbitration" className="flex-1 min-h-[600px]">
              <Card className="border-none shadow-sm overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                  <div>
                    <CardTitle className="text-lg">Arbitration Status Overview</CardTitle>
                    <CardDescription>Volumetric distribution of legal statuses</CardDescription>
                  </div>
                  <ClipboardList className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.arbStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={100}
                        outerRadius={160}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                      >
                        {stats.arbStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dispatch" className="flex-1 min-h-[600px]">
              <Card className="border-none shadow-sm overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                  <div>
                    <CardTitle className="text-lg">Deployment Status Agent-wise</CardTitle>
                    <CardDescription>Dispatch pipeline efficiency per team member</CardDescription>
                  </div>
                  <Send className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dispatchStats} layout="vertical" margin={{ left: 50, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fontWeight: 600 }}
                      />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Legend />
                      <Bar name="Dispatched" dataKey="Dispatched" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar name="Pending" dataKey="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                      <Bar name="Hold" dataKey="Hold" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                      <Bar name="Closed" dataKey="Closed" stackId="a" fill="#64748b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="flex-1 min-h-[600px]">
              <Card className="border-none shadow-sm overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                  <div>
                    <CardTitle className="text-lg">Aggregate TOS Valuation</CardTitle>
                    <CardDescription>Total Terms of Service value of dispatched cases</CardDescription>
                  </div>
                  <DollarSign className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.tosStats} margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false}
                        tickFormatter={(value) => `₹${value.toLocaleString()}`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Total TOS']}
                      />
                      <Bar 
                        dataKey="totalTOS" 
                        fill="url(#colorValue)" 
                        radius={[6, 6, 0, 0]} 
                        barSize={60}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="company_trends" className="flex-1 min-h-[600px]">
              <Card className="border-none shadow-sm overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between pb-4 shrink-0">
                  <div>
                    <CardTitle className="text-lg">Month Wise Pivot by Company</CardTitle>
                    <CardDescription>Total cases received per month split by company</CardDescription>
                  </div>
                  <Building2 className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthCompanyStats} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fontWeight: 500 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />
                      {stats.companiesList.map((company, index) => (
                        <Bar 
                          key={company}
                          dataKey={company}
                          stackId="a"
                          fill={COLORS[index % COLORS.length]}
                          name={company}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

