'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebase } from "@/components/FirebaseProvider";
import { calculateAgeing } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, FileText, Building2, AlertTriangle } from "lucide-react";

export function DashboardStats() {
  const { filteredCases: cases } = useFirebase();

  const totalCases = cases.length;
  const pendingCases = cases.filter(c => c.dispatchStatus !== 'Dispatched').length;
  const completedCases = cases.filter(c => c.dispatchStatus === 'Dispatched').length;
  
  const overdueCases = cases.filter(c => {
    const ageing = calculateAgeing(c.receivedDate);
    return ageing !== null && ageing > 7 && c.dispatchStatus !== 'Dispatched';
  }).length;

  const integroCases = cases.filter(c => 
    c.company?.toLowerCase().includes('integro')
  ).length;

  const adityaBirlaCases = cases.filter(c => 
    c.company?.toLowerCase().includes('aditya birla')
  ).length;

  const highPriorityCases = cases.filter(c => c.priority === 'High').length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCases}</div>
          <p className="text-xs text-muted-foreground">Total registered cases</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingCases}</div>
          <p className="text-xs text-muted-foreground">Cases awaiting dispatch</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedCases}</div>
          <p className="text-xs text-muted-foreground">Successfully dispatched</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue (&gt;7 Days)</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overdueCases}</div>
          <p className="text-xs text-muted-foreground">High priority attention</p>
        </CardContent>
      </Card>
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Integro Finserv</CardTitle>
          <Building2 className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">{integroCases}</div>
          <p className="text-xs text-blue-600/70">Total company cases</p>
        </CardContent>
      </Card>
      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Aditya Birla Ltd</CardTitle>
          <Building2 className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-700">{adityaBirlaCases}</div>
          <p className="text-xs text-indigo-600/70">Total company cases</p>
        </CardContent>
      </Card>
      <Card className="border-red-100 bg-red-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">{highPriorityCases}</div>
          <p className="text-xs text-red-600/70">Requires immediate action</p>
        </CardContent>
      </Card>
    </div>
  );
}
