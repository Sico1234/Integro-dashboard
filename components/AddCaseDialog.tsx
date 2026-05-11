'use client';

import { useState } from 'react';
import { useFirebase } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateUniqueId, normalizeDate, cn } from '@/lib/utils';
import { sendAssignmentEmail } from '@/lib/email-utils';
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
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function AddCaseDialog() {
  const { getNextCaseCounter, agents } = useFirebase();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const counter = await getNextCaseCounter();
      const uniqueId = generateUniqueId(counter);

      const rawReceivedDate = formData.get('receivedDate') as string;
      const normalizedReceived = normalizeDate(rawReceivedDate);
      const receivedDate = normalizedReceived ? Timestamp.fromDate(normalizedReceived) : null;

      const rawNoticeDate = formData.get('noticeDate') as string;
      const normalizedNotice = normalizeDate(rawNoticeDate);
      const noticeDate = normalizedNotice ? Timestamp.fromDate(normalizedNotice) : null;

      const caseData = {
        agmtNo: formData.get('agmtNo'),
        uniqueId: uniqueId,
        borrowerName: formData.get('borrowerName'),
        company: formData.get('company'),
        noticeDate: noticeDate,
        receivedDate: receivedDate,
        fro: formData.get('fro') || '',
        to: formData.get('to') || '',
        pos: formData.get('pos') || '',
        tos: formData.get('tos') || '',
        dsSbRemarks: formData.get('dsSbRemarks') || '',
        actionToBeTaken: formData.get('actionToBeTaken') || '',
        comments: formData.get('comments') || '',
        assignedTo: formData.get('assignedTo') || '',
        pool: formData.get('pool') || '',
        dispatchStatus: 'Pending',
        priority: formData.get('priority') || 'Medium',
        arbitrationStatus: formData.get('arbitrationStatus') || '',
        dsSbRemarksDate: formData.get('dsSbRemarks') ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'cases'), caseData);
      toast.success(`Case added successfully with ID: ${uniqueId}`);

      // Send assignment email if assigned
      if (caseData.assignedTo) {
        const agent = agents.find(a => a.name.toLowerCase().trim() === String(caseData.assignedTo).toLowerCase().trim());
        if (agent?.email) {
          await sendAssignmentEmail(agent.email, agent.name, caseData);
        }
      }

      setOpen(false);
    } catch (error) {
      console.error('Error adding case:', error);
      toast.error('Failed to add case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'default' }), "gap-2")}>
        <Plus className="h-4 w-4" /> Add New Case
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Add New Case</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <form id="add-case-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="agmtNo">Agmt No.</Label>
              <Input id="agmtNo" name="agmtNo" placeholder="e.g. 0KG829412F..." required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="borrowerName">Borrower Name</Label>
              <Input id="borrowerName" name="borrowerName" placeholder="Mr. Sumit Shukla" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" placeholder="Integro Finserv Pvt Ltd." required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="arbitrationStatus">Arbitration status</Label>
              <Input id="arbitrationStatus" name="arbitrationStatus" placeholder="e.g. Ongoing" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="noticeDate">Notice Date</Label>
              <Input id="noticeDate" name="noticeDate" type="date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fro">From</Label>
                <Input id="fro" name="fro" placeholder="e.g. Mumbai" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" name="to" placeholder="e.g. Delhi" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pos">POS</Label>
                <Input id="pos" name="pos" placeholder="Principal Outstanding" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tos">TOS</Label>
                <Input id="tos" name="tos" placeholder="Total Outstanding" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="receivedDate">Received Date</Label>
              <Input id="receivedDate" name="receivedDate" type="date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dsSbRemarks">DS/SB Remarks</Label>
              <Input id="dsSbRemarks" name="dsSbRemarks" placeholder="e.g. OVERLAP" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actionToBeTaken">Action to be taken</Label>
              <Input id="actionToBeTaken" name="actionToBeTaken" placeholder="Next steps..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comments">Comments</Label>
              <Input id="comments" name="comments" placeholder="General notes..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pool">POOL</Label>
              <select 
                id="pool" 
                name="pool" 
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select Pool</option>
                <option value="POOL-1">POOL-1</option>
                <option value="POOL-2">POOL-2</option>
                <option value="POOL-3">POOL-3</option>
                <option value="POOL-4">POOL-4</option>
                <option value="POOL-5">POOL-5</option>
                <option value="POOL-6">POOL-6</option>
                <option value="POOL-7">POOL-7</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <select 
                id="priority" 
                name="priority" 
                defaultValue="Medium"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <select 
                id="assignedTo" 
                name="assignedTo" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>
          </form>
        </div>
        <div className="p-6 pt-2 border-t bg-slate-50/50">
          <Button type="submit" form="add-case-form" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Case'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
