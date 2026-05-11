'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useFirebase } from '@/components/FirebaseProvider';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

export function ManageAgentsDialog() {
  const { agents } = useFirebase();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const agentData = {
      name: formData.get('name'),
      email: formData.get('email'),
    };

    try {
      await addDoc(collection(db, 'agents'), agentData);
      toast.success('Agent added successfully');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error adding agent:', error);
      toast.error('Failed to add agent');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'agents', id));
      toast.success('Agent deleted successfully');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), "gap-2")}>
        <Users className="h-4 w-4" /> Manage Agents
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Agents</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Add Agent Form */}
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
            <h4 className="text-sm font-semibold">Add New Agent</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-xs">Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required className="h-8 text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" name="email" type="email" placeholder="john@example.com" className="h-8 text-xs" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-8 text-xs gap-2">
              <UserPlus className="h-3.5 w-3.5" />
              {loading ? 'Adding...' : 'Add Agent'}
            </Button>
          </form>

          {/* Agents List */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold px-1">Current Agents ({agents.length})</h4>
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {agents.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground italic">No agents found. Add one above.</p>
              ) : (
                agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.email || 'No email'}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirm({ id: agent.id, name: agent.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Custom Confirmation Overlay */}
        {deleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="p-6 max-w-[300px] text-center space-y-4 border rounded-xl shadow-xl bg-white">
              <div className="space-y-2">
                <h4 className="font-bold text-lg">Delete Agent?</h4>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirm.name}</span>?
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
