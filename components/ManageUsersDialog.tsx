'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, query, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/components/FirebaseProvider';
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function ManageUsersDialog() {
  const { user: currentUser } = useFirebase();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; username: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        fetchUsers();
      }, 0);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const email = formData.get('email') as string;

    try {
      // Check if user already exists
      const q = query(collection(db, 'users'), where('username', '==', username));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        toast.error('Username already exists');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'users'), {
        username,
        password,
        role,
        email: role === 'agent' ? email : '',
        passwordUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      toast.success('User created successfully');
      (e.target as HTMLFormElement).reset();
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (users.find(u => u.id === id)?.username === currentUser?.username) {
      toast.error('You cannot delete your own account');
      setDeleteConfirm(null);
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('User deleted successfully');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), "gap-2")}>
        <ShieldCheck className="h-4 w-4" /> Manage Access
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>System Access Management</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Add User Form */}
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
            <h4 className="text-sm font-semibold">Create New User Account</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username" className="text-xs">Username</Label>
                <Input id="username" name="username" placeholder="johndoe" required className="h-8 text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="role" className="text-xs">Role</Label>
                <select 
                  id="role" 
                  name="role" 
                  required 
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  defaultValue="admin"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs">Agent Email (if Agent)</Label>
                <Input id="email" name="email" type="email" placeholder="agent@example.com" className="h-8 text-xs" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-8 text-xs gap-2">
              <UserPlus className="h-3.5 w-3.5" />
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </form>

          {/* Users List */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold px-1">Authorized Users ({users.length})</h4>
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {u.username}
                      {u.username === currentUser?.username && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">You</span>
                      )}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        u.role === 'admin' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      )}>
                        {u.role || 'admin'}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {u.role === 'agent' ? u.email : 'System Administrator'}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteConfirm({ id: u.id, username: u.username })}
                    disabled={u.username === currentUser?.username}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Confirmation Overlay */}
        {deleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="p-6 max-w-[300px] text-center space-y-4 border rounded-xl shadow-xl bg-white">
              <div className="space-y-2">
                <h4 className="font-bold text-lg">Revoke Access?</h4>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete the account for <span className="font-semibold text-foreground">{deleteConfirm.username}</span>?
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setDeleteConfirm(null)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1" 
                  onClick={() => handleDelete(deleteConfirm.id)}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
