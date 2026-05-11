'use client';

import { useFirebase } from "@/components/FirebaseProvider";
import { DashboardStats } from "@/components/DashboardStats";
import { CaseTable } from "@/components/CaseTable";
import { AddCaseDialog } from "@/components/AddCaseDialog";
import { ManageAgentsDialog } from "@/components/ManageAgentsDialog";
import { ManageUsersDialog } from "@/components/ManageUsersDialog";
import { LogExport } from "@/components/LogExport";
import { ImportCases } from "@/components/ImportCases";
import { SyncUniqueIdDialog } from "@/components/SyncUniqueIdDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { VisualInsights } from "@/components/VisualInsights";
import { LogIn, LogOut, LayoutDashboard, Database, User as UserIcon, Lock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user, loading, login, logout } = useFirebase();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }
    setIsLoggingIn(true);
    const success = await login(username, password);
    setIsLoggingIn(false);
    if (!success) {
      toast.error("Invalid credentials");
    } else {
      toast.success("Welcome back!");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Initializing system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[440px] z-10"
        >
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
            <div className="p-8 pb-0 text-center">
              <div className="flex justify-center mb-6">
                <Logo className="flex-col" />
              </div>
              <p className="text-slate-500 mt-2 text-sm">Enter your credentials to access the system</p>
            </div>

            <form onSubmit={handleLogin} className="p-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Username</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    id="username"
                    type="text" 
                    placeholder="Enter username" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</Label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const subject = encodeURIComponent("MIS Password Reset Request");
                      const body = encodeURIComponent(`Hello,\n\nI would like to request a password reset for the Integro MIS system.\n\nUsername: ${username || 'integro'}\n\nPlease provide the new credentials.\n\nRegards.`);
                      window.location.href = `mailto:yashdeepghag763@gmail.com?subject=${subject}&body=${body}`;
                      toast.success("Opening your email client to notify yashdeepghag763@gmail.com");
                    }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Sign In
                  </div>
                )}
              </Button>
            </form>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">
                Professional Internal Management System
              </p>
            </div>
          </div>
          
          <p className="text-center mt-8 text-slate-400 text-xs">
            &copy; {new Date().getFullYear()} Integro MIS. All rights reserved.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Expiration Warning */}
      <AnimatePresence>
        {user.isExpired && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 overflow-hidden"
          >
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-medium">
                  Your password has expired (it&apos;s been more than 3 months). Please update it for security.
                </p>
              </div>
              <ChangePasswordDialog trigger={
                <Button variant="outline" size="sm" className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100">
                  Update Password Now
                </Button>
              } />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <Logo />
            <VisualInsights />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 mr-4">
              <div className="text-right">
                <p className="text-sm font-bold leading-none text-slate-900">{user.username}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">
                  {user.role === 'admin' ? 'System Administrator' : 'Agent'}
                </p>
              </div>
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <UserIcon className="h-5 w-5 text-slate-600" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <ChangePasswordDialog trigger={
                <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
                  <Lock className="h-4 w-4" /> <span className="hidden sm:inline">Password</span>
                </Button>
              } />
              <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
            <p className="text-slate-500 mt-1">Manage and track all cases in real-time.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LogExport />
            {user.role === 'admin' && (
              <>
                <ImportCases />
                <SyncUniqueIdDialog />
                <ManageUsersDialog />
                <ManageAgentsDialog />
                <AddCaseDialog />
              </>
            )}
          </div>
        </div>

        <DashboardStats />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Active Cases</h3>
          </div>
          <CaseTable />
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Integro MIS. Professional Internal Tool.
          </p>
        </div>
      </footer>
    </div>
  );
}
