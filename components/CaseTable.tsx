'use client';

import { useState, useMemo, useRef, useEffect, memo, useDeferredValue } from 'react';
import { useFirebase } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { buttonVariants } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon, Search, Edit2, Check, X, ChevronDown, Trash2, Filter, Mail, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, calculateAgeing, getAgeingColor, formatDate, normalizeDate } from "@/lib/utils";
import { toast } from 'sonner';

import { BulkEditCases } from './BulkEditCases';
import { BulkAssignCases } from './BulkAssignCases';

import { sendAssignmentEmail, sendBulkAssignmentEmail } from '@/lib/email-utils';

const InlineInput = ({ value: initialValue, onSave, disabled, ...props }: any) => {
  const normalizedInitial = initialValue || '';
  const [value, setValue] = useState(normalizedInitial);
  const [prevValue, setPrevValue] = useState(normalizedInitial);

  if (normalizedInitial !== prevValue) {
    setPrevValue(normalizedInitial);
    setValue(normalizedInitial);
  }

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      onBlur={() => {
        if (!disabled && value !== (initialValue || '')) {
          onSave(value);
        }
      }}
    />
  );
};

const InlineTextarea = ({ value: initialValue, onSave, disabled, ...props }: any) => {
  const normalizedInitial = initialValue || '';
  const [value, setValue] = useState(normalizedInitial);
  const [prevValue, setPrevValue] = useState(normalizedInitial);

  if (normalizedInitial !== prevValue) {
    setPrevValue(normalizedInitial);
    setValue(normalizedInitial);
  }

  return (
    <Textarea
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      onBlur={() => {
        if (!disabled && value !== (initialValue || '')) {
          onSave(value);
        }
      }}
    />
  );
};

const CaseRow = memo(({ 
  item, 
  isAgent, 
  selectedIds, 
  toggleSelect, 
  columnWidths, 
  handleFieldUpdate, 
  handleStartEdit, 
  agents 
}: any) => {
  const ageing = calculateAgeing(item.receivedDate);
  const ageingColor = getAgeingColor(ageing, item.dispatchStatus);

  return (
    <motion.tr 
        layout
       initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
        "hover:bg-gray-50/50 transition-colors border-b",
        selectedIds.includes(item.id) && "bg-primary/10 hover:bg-primary/15 shadow-[inset_4px_0_0_0_theme(colors.primary.DEFAULT)]"
      )}
    >
      <TableCell className="border-r px-2">
        <input 
          type="checkbox" 
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-transform active:scale-90"
          checked={selectedIds.includes(item.id)}
          onChange={() => toggleSelect(item.id)}
        />
      </TableCell>
      <TableCell className="font-mono text-xs border-r font-bold text-primary" style={{ width: columnWidths.uniqueId, minWidth: columnWidths.uniqueId }}>
        {item.uniqueId || '-'}
      </TableCell>
      <TableCell className="font-mono text-xs border-r" style={{ width: columnWidths.agmtNo, minWidth: columnWidths.agmtNo }}>
        <InlineInput 
          key={`agmt-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Agmt No."
          value={item.agmtNo}
          onSave={(val: string) => handleFieldUpdate(item, 'agmtNo', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.noticeDate, minWidth: columnWidths.noticeDate }}>
        <Popover>
          <PopoverTrigger render={
            <Button
              variant={"ghost"}
              className={cn(
                "h-8 w-full justify-start text-left font-normal text-xs px-2 hover:bg-white border border-transparent hover:border-input transition-all",
                !item.noticeDate && "text-muted-foreground"
              )}
              disabled={isAgent}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {item.noticeDate ? formatDate(item.noticeDate) : <span>Pick date</span>}
            </Button>
          } />
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col">
              <Calendar
                mode="single"
                selected={item.noticeDate?.toDate()}
                onSelect={(date) => {
                  handleFieldUpdate(item, 'noticeDate', date ? Timestamp.fromDate(normalizeDate(date)!) : null);
                }}
                initialFocus
              />
              <div className="p-2 border-t mt-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleFieldUpdate(item, 'noticeDate', null)}
                >
                  Clear Date
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.receivedDate, minWidth: columnWidths.receivedDate }}>
        <Popover>
          <PopoverTrigger render={
            <Button
              variant={"ghost"}
              className={cn(
                "h-8 w-full justify-start text-left font-normal text-xs px-2 hover:bg-white border border-transparent hover:border-input transition-all",
                !item.receivedDate && "text-muted-foreground"
              )}
              disabled={isAgent}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {item.receivedDate ? formatDate(item.receivedDate) : <span>Pick date</span>}
            </Button>
          } />
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col">
              <Calendar
                mode="single"
                selected={item.receivedDate?.toDate()}
                onSelect={(date) => {
                  handleFieldUpdate(item, 'receivedDate', date ? Timestamp.fromDate(normalizeDate(date)!) : null);
                }}
                initialFocus
              />
              <div className="p-2 border-t mt-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleFieldUpdate(item, 'receivedDate', null)}
                >
                  Clear Date
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.ageing, minWidth: columnWidths.ageing }}>
        <div className="flex items-center gap-2">
          {ageing !== null && (
            <Badge variant="outline" className={cn("font-bold transition-all hover:scale-105", ageingColor)}>
              {ageing} Days
            </Badge>
          )}
          {ageing !== null && ageing > 7 && (item.dispatchStatus === 'Pending' || !item.dispatchStatus) && (
            <div className="flex items-center gap-1">
              {item.overdueEmailSent ? (
                <div className="flex items-center gap-1 text-green-600" title="Automatic overdue email sent">
                  <Mail className="h-4 w-4" />
                  <Check className="h-3 w-3" />
                </div>
              ) : (
                <a 
                  href={`mailto:${agents.find((a: any) => a.name === item.assignedTo)?.email || ''}?cc=supriya@indialaw.in&subject=Urgent: Case Ageing Notification - ${item.agmtNo}&body=Hello ${item.assignedTo || 'Agent'},%0D%0A%0D%0AThis is a notification that the case with Agreement No. ${item.agmtNo} has been pending for ${ageing} days. Please take necessary action.%0D%0A%0D%0ARegards,%0D%0ACase Tracking System`}
                  className="text-primary hover:text-primary/80 transition-colors active:scale-90"
                  title="Notify Agent via Email (Manual)"
                >
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.fro, minWidth: columnWidths.fro }}>
        <InlineInput 
          key={`fro-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="From"
          value={item.fro}
          onSave={(val: string) => handleFieldUpdate(item, 'fro', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.to, minWidth: columnWidths.to }}>
        <InlineInput 
          key={`to-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="To"
          value={item.to}
          onSave={(val: string) => handleFieldUpdate(item, 'to', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="font-medium border-r" style={{ width: columnWidths.borrowerName, minWidth: columnWidths.borrowerName }}>
        <InlineInput 
          key={`borrower-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Borrower Name"
          value={item.borrowerName}
          onSave={(val: string) => handleFieldUpdate(item, 'borrowerName', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.pos, minWidth: columnWidths.pos }}>
        <InlineInput 
          key={`pos-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="POS"
          value={item.pos}
          onSave={(val: string) => handleFieldUpdate(item, 'pos', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.tos, minWidth: columnWidths.tos }}>
        <InlineInput 
          key={`tos-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="TOS"
          value={item.tos}
          onSave={(val: string) => handleFieldUpdate(item, 'tos', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r group relative" style={{ width: columnWidths.dsSbRemarks, minWidth: columnWidths.dsSbRemarks }}>
        <InlineInput 
          key={`remarks-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Remarks"
          value={item.dsSbRemarks}
          onSave={(val: string) => handleFieldUpdate(item, 'dsSbRemarks', val)}
          disabled={isAgent}
        />
        {item.dsSbRemarksDate && (
          <div className="absolute top-1 right-1.5 text-[9px] text-muted-foreground opacity-30 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white/80 px-0.5 rounded">
            {formatDate(item.dsSbRemarksDate)}
          </div>
        )}
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.assignedTo, minWidth: columnWidths.assignedTo }}>
        <Select 
          value={item.assignedTo || 'Unassigned'} 
          onValueChange={(val: string | null) => handleFieldUpdate(item, 'assignedTo', val === 'Unassigned' || !val ? '' : val)}
          disabled={isAgent}
        >
          <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent focus:bg-white transition-all">
            <SelectValue placeholder="Assign To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Unassigned">Unassigned</SelectItem>
            {agents.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.name}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.actionToBeTaken, minWidth: columnWidths.actionToBeTaken }}>
        <InlineInput 
          key={`action-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Action..."
          value={item.actionToBeTaken}
          onSave={(val: string) => handleFieldUpdate(item, 'actionToBeTaken', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.comments, minWidth: columnWidths.comments }}>
        <InlineTextarea 
          key={`comments-${item.id}`}
          className="min-h-[32px] h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white resize-none py-1 transition-all" 
          placeholder="Add comments..."
          value={item.comments}
          onSave={(val: string) => handleFieldUpdate(item, 'comments', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.dispatchStatus, minWidth: columnWidths.dispatchStatus }}>
        <Select 
          value={item.dispatchStatus || 'Pending'} 
          onValueChange={(val: string | null) => handleFieldUpdate(item, 'dispatchStatus', val || 'Pending')}
          disabled={isAgent}
        >
          <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent focus:bg-white transition-all">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Dispatched">Dispatched</SelectItem>
            <SelectItem value="Hold">Hold</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.dispatchedDate, minWidth: columnWidths.dispatchedDate }}>
        <Popover>
          <PopoverTrigger render={
            <Button
              variant={"ghost"}
              className={cn(
                "h-8 w-full justify-start text-left font-normal text-xs px-2 hover:bg-white border border-transparent hover:border-input transition-all",
                !item.dispatchedDate && "text-muted-foreground"
              )}
              disabled={isAgent}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {item.dispatchedDate ? formatDate(item.dispatchedDate) : <span>Pick date</span>}
            </Button>
          } />
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col">
              <Calendar
                mode="single"
                selected={item.dispatchedDate?.toDate()}
                onSelect={(date) => {
                  handleFieldUpdate(item, 'dispatchedDate', date ? Timestamp.fromDate(normalizeDate(date)!) : null);
                }}
                initialFocus
              />
              <div className="p-2 border-t mt-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleFieldUpdate(item, 'dispatchedDate', null)}
                >
                  Clear Date
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.priority, minWidth: columnWidths.priority }}>
        <Select 
          value={item.priority || "Medium"} 
          onValueChange={(val: string | null) => handleFieldUpdate(item, 'priority', val || 'Medium')}
          disabled={isAgent}
        >
          <SelectTrigger className={cn(
            "h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all",
            item.priority === 'High' && "text-red-600 font-bold",
            item.priority === 'Medium' && "text-amber-600 font-bold",
            item.priority === 'Low' && "text-blue-600 font-bold"
          )}>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="border-r" style={{ width: columnWidths.company, minWidth: columnWidths.company }}>
        <InlineInput 
          key={`company-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Company"
          value={item.company}
          onSave={(val: string) => handleFieldUpdate(item, 'company', val)}
          disabled={isAgent}
        />
      </TableCell>
<TableCell
  className="border-r"
  style={{
    width: columnWidths.pool,
    minWidth: columnWidths.pool,
  }}
>
  <Input
    list={`pool-options-${item.id}`}
    className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all"
    placeholder="Select or type pool"
    value={item.pool || ""}
    onChange={(e) =>
      handleFieldUpdate(item, "pool", e.target.value)
    }
    disabled={isAgent}
  />

  <datalist id={`pool-options-${item.id}`}>
    <option value="POOL-1" />
    <option value="POOL-2" />
    <option value="POOL-3" />
    <option value="POOL-4" />
    <option value="POOL-5" />
    <option value="POOL-6" />
    <option value="POOL-7" />
  </datalist>
</TableCell>

<TableCell
  className="border-r"
  style={{
    width: columnWidths.arbitrators,
    minWidth: columnWidths.arbitrators,
  }}
>
  <InlineInput
    key={`arbitrators-${item.id}`}
    className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all"
    placeholder="Arbitrators"
    value={item.arbitrators}
    onSave={(val: string) => handleFieldUpdate(item, "arbitrators", val)}
    disabled={isAgent}
  />
</TableCell>

        <TableCell className="border-r" style={{ width: columnWidths.arbitrationStatus, minWidth: columnWidths.arbitrationStatus }}>
        <InlineInput 
          key={`arb-${item.id}`}
          className="h-8 text-xs border-transparent hover:border-input focus:border-input bg-transparent focus:bg-white transition-all" 
          placeholder="Status"
          value={item.arbitrationStatus}
          onSave={(val: string) => handleFieldUpdate(item, 'arbitrationStatus', val)}
          disabled={isAgent}
        />
      </TableCell>
      <TableCell className="px-2" style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}>
        {!isAgent && (
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-primary hover:bg-primary/10 transition-colors active:scale-90"
              onClick={() => handleStartEdit(item)}
>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </TableCell>
    </motion.tr>
  );
});

CaseRow.displayName = 'CaseRow';

export function CaseTable() {
  const { 
    cases, 
    agents, 
    user, 
    search, 
    setSearch, 
    columnFilters, 
    setColumnFilters, 
    filteredCases,
    exportableCases 
  } = useFirebase();
  const isAgent = user?.role === 'agent';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tableWidth, setTableWidth] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    uniqueId: 100,
    agmtNo: 150,
    noticeDate: 120,
    receivedDate: 120,
    ageing: 100,
    fro: 120,
    to: 120,
    borrowerName: 200,
    pos: 120,
    tos: 120,
    dsSbRemarks: 250,
    assignedTo: 150,
    actionToBeTaken: 150,
    comments: 250,
    dispatchStatus: 150,
    dispatchedDate: 150,
    company: 150,
    pool: 150,
    arbitrators: 180,
    arbitrationStatus: 150,
    priority: 120,
    actions: 100,
  });

  const resizingRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    resizingRef.current = {
      field,
      startX: e.pageX,
      startWidth: columnWidths[field] || 150,
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    setIsResizing(true);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { field, startX, startWidth } = resizingRef.current;
    const diff = e.pageX - startX;
    const newWidth = Math.max(50, startWidth + diff);
    setColumnWidths(prev => ({ ...prev, [field]: newWidth }));
  };

  const handleResizeEnd = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    setIsResizing(false);
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'ageing',
    direction: 'desc'
  });

  const sortedCases = useMemo(() => {
    let sortableItems = [...filteredCases];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'ageing') {
          aValue = calculateAgeing(a.receivedDate) || 0;
          bValue = calculateAgeing(b.receivedDate) || 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue instanceof Timestamp) aValue = aValue.toDate().getTime();
        if (bValue instanceof Timestamp) bValue = bValue.toDate().getTime();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredCases, sortConfig]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filteredCases, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedCases.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCases = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return sortedCases.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCases, validCurrentPage]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current && topScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const progress = (scrollLeft / (scrollWidth - clientWidth)) * 100;
        setScrollProgress(isNaN(progress) ? 0 : progress);
        
        if (Math.abs(topScrollRef.current.scrollLeft - scrollLeft) > 1) {
          topScrollRef.current.scrollLeft = scrollLeft;
        }
      }
    };

    const handleTopScroll = () => {
      if (topScrollRef.current && scrollRef.current) {
        if (Math.abs(scrollRef.current.scrollLeft - topScrollRef.current.scrollLeft) > 1) {
          scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
      }
    };

    const currentScrollRef = scrollRef.current;
    const currentTopScrollRef = topScrollRef.current;

    if (currentScrollRef) {
      currentScrollRef.addEventListener('scroll', handleScroll);
    }
    if (currentTopScrollRef) {
      currentTopScrollRef.addEventListener('scroll', handleTopScroll);
    }

    // Update table width for top scrollbar
    const updateWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.scrollWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      if (currentScrollRef) {
        currentScrollRef.removeEventListener('scroll', handleScroll);
      }
      if (currentTopScrollRef) {
        currentTopScrollRef.removeEventListener('scroll', handleTopScroll);
      }
      window.removeEventListener('resize', updateWidth);
    };
  }, [filteredCases, columnWidths]);

  const handleStartEdit = (item: any) => {
    if (isAgent) {
      toast.error('You do not have permission to edit cases');
      return;
    }

    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleSaveEdit = async () => {
    if (isAgent) {
      toast.error('You do not have permission to edit cases');
      return;
    }

    if (!editingId || !editData) return;
    
    try {
      const docRef = doc(db, 'cases', editingId);
      const { id, ...updatePayload } = editData;
      await updateDoc(docRef, updatePayload);
      toast.success('Case updated');
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cases/${editingId}`, user);
      toast.error('Failed to update case');
    }
  };

  const handleFieldUpdate = async (item: any, field: string, value: any) => {
    if (isAgent) {
      toast.error('You do not have permission to edit cases');
      return;
    }

    try {
      const docRef = doc(db, 'cases', item.id);
      const updateData: any = { [field]: value };
      
      if (field === 'dsSbRemarks') {
        updateData.dsSbRemarksDate = serverTimestamp();
      }
      
      await updateDoc(docRef, updateData);
      toast.success('Updated');

      if (field === 'assignedTo' && value) {
        const agent = agents.find(a => a.name === value);
        if (agent?.email) {
          await sendAssignmentEmail(agent.email, agent.name, item);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cases/${item.id}`, user);
      toast.error('Failed to update');
    }
  };

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId: string | undefined;
      email: string | null | undefined;
      emailVerified: boolean | undefined;
      isAnonymous: boolean | undefined;
      tenantId: string | null | undefined;
      providerInfo: {
        providerId: string;
        displayName: string | null;
        email: string | null;
        photoUrl: string | null;
      }[];
    }
  }

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null, user: any) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
        tenantId: user?.tenantId,
        providerInfo: user?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  const selectableCases = useMemo(() => {
    const allowedIds = new Set(exportableCases.map((c: any) => c.id));
    return filteredCases.filter((c: any) => allowedIds.has(c.id));
  }, [filteredCases, exportableCases]);

  const selectedCasesForExport = useMemo(() => {
    const allowedIds = new Set(exportableCases.map((c: any) => c.id));
    return cases.filter((c: any) => selectedIds.includes(c.id) && allowedIds.has(c.id));
  }, [cases, selectedIds, exportableCases]);

  const toggleSelectAll = () => {
    if (selectedIds.length === selectableCases.length && selectableCases.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableCases.map((c: any) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    const isAllowed = exportableCases.some((c: any) => c.id === id);

    if (!isAllowed) {
      toast.error('You can only select cases assigned to you');
      return;
    }

    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async (field: string, value: any) => {
    if (isAgent) {
      toast.error('You do not have permission to bulk edit cases');
      return;
    }

    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const batch = writeBatch(db);
    
    try {
      const selectedCases = cases.filter(c => selectedIds.includes(c.id));
      
      selectedIds.forEach(id => {
        const docRef = doc(db, 'cases', id);
        const updateData: any = { [field]: value };
        if (field === 'feedback') updateData.feedbackDate = serverTimestamp();
        if (field === 'action') updateData.actionDate = serverTimestamp();
        batch.update(docRef, updateData);
      });
      
      await batch.commit();
      toast.success(`Bulk updated ${selectedIds.length} cases`);

      // Send bulk assignment emails if field is assignedTo
      if (field === 'assignedTo' && value) {
        const agent = agents.find(a => a.name === value);
        if (agent?.email) {
          await sendBulkAssignmentEmail(agent.email, agent.name, selectedCases);
        }
      }

      setSelectedIds([]);
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to perform bulk update');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (isAgent) {
      toast.error('You do not have permission to delete cases');
      return;
    }

    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    const batch = writeBatch(db);
    
    try {
      selectedIds.forEach(id => {
        const docRef = doc(db, 'cases', id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      toast.success(`Deleted ${selectedIds.length} cases`);
      setSelectedIds([]);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to perform bulk delete');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.length === 0) return;
    const toastId = toast.loading("Preparing export...");
    
    try {
      const selectedCases = cases.filter(c => selectedIds.includes(c.id));
      
      const data = selectedCases.map(c => ({
        'Unique ID': c.uniqueId || '',
        'Agmt No.': c.agmtNo || '',
        'Notice Date': c.noticeDate ? formatDate(c.noticeDate) : '',
        'Received Date': c.receivedDate ? formatDate(c.receivedDate) : '',
        'Ageing': calculateAgeing(c.receivedDate) || 0,
        'Fro': c.fro || '',
        'To': c.to || '',
        'Borrower Name': c.borrowerName || '',
        'POS': c.pos || '',
        'TOS': c.tos || '',
        'DS/SB Remarks': c.dsSbRemarks || '',
        'Assigned To': c.assignedTo || '',
        'Action to be taken': c.actionToBeTaken || '',
        'Comments': c.comments || '',
        'Dispatch Status': c.dispatchStatus || 'Pending',
        'Dispatch Date': c.dispatchedDate ? formatDate(c.dispatchedDate) : '',
        'Company': c.company || '',
        'POOL': c.pool || '',
        'Arbitrators': c.arbitrators || '',
        'Priority': c.priority || 'Medium',
        'Arbitration Status': c.arbitrationStatus || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Cases");
      
      const fileName = `${user?.username || 'User'}_Selected_Cases_${format(new Date(), 'dd-MM-yyyy_HHmm')}.xlsx`;
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${selectedCases.length} cases`, { id: toastId });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred during export.", { id: toastId });
    }
  };

  const handleColumnFilterChange = (field: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full">
          <div className="flex items-center gap-2 max-w-sm w-full">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search ID, Agmt No., Name, or Company..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-9 gap-2", showFilters && "bg-primary/10 border-primary text-primary")}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {Object.values(columnFilters).filter(Boolean).length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] justify-center">
                {Object.values(columnFilters).filter(Boolean).length}
              </Badge>
            )}
            Filters
          </Button>
          {Object.values(columnFilters).filter(Boolean).length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 text-xs text-muted-foreground"
              onClick={() => setColumnFilters({})}
            >
              Reset
            </Button>
          )}
          {!isAgent && (
            <>
              <BulkEditCases />
              <BulkAssignCases />
            </>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-medium text-primary whitespace-nowrap">
              {selectedIds.length} selected
            </span>
            <div className="h-4 w-[1px] bg-primary/20 mx-1" />

            {!isAgent && (
              <>
                <Select onValueChange={(val: string | null) => val && handleBulkUpdate('status', val)} disabled={isBulkUpdating}>
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-white">
                    <SelectValue placeholder="Bulk Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OVERLAP">OVERLAP</SelectItem>
                    <SelectItem value="FRESH">FRESH</SelectItem>
                    <SelectItem value="RE-VERIFICATION">RE-VERIFICATION</SelectItem>
                  </SelectContent>
                </Select>

                <Select onValueChange={(val: string | null) => val && handleBulkUpdate('dispatchStatus', val)} disabled={isBulkUpdating}>
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-white">
                    <SelectValue placeholder="Bulk Dispatch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="Hold">Hold</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs bg-white gap-1.5"
              onClick={handleBulkExport}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>

            {!isAgent && (
              <Dialog>
                <DialogTrigger 
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    "h-8 text-xs text-destructive hover:bg-destructive/10",
                    isBulkUpdating && "pointer-events-none opacity-50"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Cases</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {selectedIds.length} selected cases? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <Button 
                      variant="destructive" 
                      onClick={handleBulkDelete} 
                      disabled={isBulkUpdating}
                    >
                      {isBulkUpdating ? "Deleting..." : "Delete"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border bg-white overflow-hidden flex flex-col">
        {/* Top Scrollbar Sync */}
        <div 
          ref={topScrollRef}
          className="overflow-x-auto custom-scrollbar h-2.5 border-b bg-gray-50/50"
        >
          <div style={{ width: `${tableWidth}px`, height: '1px' }} />
        </div>

        <div 
          ref={scrollRef}
          className="overflow-x-auto custom-scrollbar max-h-[75vh] relative"
        >
          <Table ref={tableRef} containerClassName="overflow-visible" className="border-collapse">
            <TableHeader className="relative z-30">
              <TableRow className="hover:bg-transparent bg-gray-50/50">
                <TableHead className="sticky top-0 bg-gray-50 z-40 w-[40px] border-r border-b py-3 px-2">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    checked={selectedIds.length === selectableCases.length && selectableCases.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.uniqueId, minWidth: columnWidths.uniqueId }}
                  onClick={() => requestSort('uniqueId')}
                >
                  <div className="flex items-center gap-1">
                    Unique ID
                    {sortConfig?.key === 'uniqueId' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'uniqueId')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.agmtNo, minWidth: columnWidths.agmtNo }}
                  onClick={() => requestSort('agmtNo')}
                >
                  <div className="flex items-center gap-1">
                    Agmt No.
                    {sortConfig?.key === 'agmtNo' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'agmtNo')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.noticeDate, minWidth: columnWidths.noticeDate }}
                  onClick={() => requestSort('noticeDate')}
                >
                  <div className="flex items-center gap-1">
                    Notice Date
                    {sortConfig?.key === 'noticeDate' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'noticeDate')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.receivedDate, minWidth: columnWidths.receivedDate }}
                  onClick={() => requestSort('receivedDate')}
                >
                  <div className="flex items-center gap-1">
                    Received Date
                    {sortConfig?.key === 'receivedDate' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'receivedDate')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.ageing, minWidth: columnWidths.ageing }}
                  onClick={() => requestSort('ageing')}
                >
                  <div className="flex items-center gap-1">
                    Ageing
                    {sortConfig?.key === 'ageing' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'ageing')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.fro, minWidth: columnWidths.fro }}
                >
                  Fro
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'fro')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.to, minWidth: columnWidths.to }}
                >
                  To
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'to')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.borrowerName, minWidth: columnWidths.borrowerName }}
                  onClick={() => requestSort('borrowerName')}
                >
                  <div className="flex items-center gap-1">
                    Borrower Name
                    {sortConfig?.key === 'borrowerName' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'borrowerName')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.pos, minWidth: columnWidths.pos }}
                >
                  POS
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'pos')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.tos, minWidth: columnWidths.tos }}
                >
                  TOS
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'tos')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.dsSbRemarks, minWidth: columnWidths.dsSbRemarks }}
                >
                  DS/SB Remarks
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'dsSbRemarks')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.assignedTo, minWidth: columnWidths.assignedTo }}
                >
                  Assigned To
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'assignedTo')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.actionToBeTaken, minWidth: columnWidths.actionToBeTaken }}
                >
                  Action to be taken
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'actionToBeTaken')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.comments, minWidth: columnWidths.comments }}
                >
                  Comments
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'comments')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.dispatchStatus, minWidth: columnWidths.dispatchStatus }}
                >
                  Dispatch Status
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'dispatchStatus')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.dispatchedDate, minWidth: columnWidths.dispatchedDate }}
                >
                  Dispatched Date
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'dispatchedDate')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 cursor-pointer hover:bg-gray-100 transition-colors group relative"
                  style={{ width: columnWidths.priority, minWidth: columnWidths.priority }}
                  onClick={() => requestSort('priority')}
                >
                  <div className="flex items-center gap-1">
                    Priority
                    {sortConfig?.key === 'priority' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => handleResizeStart(e, 'priority')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.company, minWidth: columnWidths.company }}
                >
                  Company
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'company')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.pool, minWidth: columnWidths.pool }}
                >
                  POOL
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'pool')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.arbitrators, minWidth: columnWidths.arbitrators }}
                >
                  Arbitrators
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'arbitrators')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-r border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.arbitrationStatus, minWidth: columnWidths.arbitrationStatus }}
                >
                  Arbitration status
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'arbitrationStatus')}
                  />
                </TableHead>
                <TableHead 
                  className="sticky top-0 bg-gray-50 z-30 border-b font-bold text-black py-3 group relative"
                  style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}
                >
                  Actions
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                    onMouseDown={(e) => handleResizeStart(e, 'actions')}
                  />
                </TableHead>
              </TableRow>
              {/* Filter Row */}
              {showFilters && (
                <TableRow className="bg-gray-50/30 animate-in fade-in slide-in-from-top-1 duration-200">
                  <TableHead className="border-r px-2 py-1"></TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.uniqueId, minWidth: columnWidths.uniqueId }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.uniqueId || ''}
                      onChange={(e) => handleColumnFilterChange('uniqueId', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.agmtNo, minWidth: columnWidths.agmtNo }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.agmtNo || ''}
                      onChange={(e) => handleColumnFilterChange('agmtNo', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.noticeDate, minWidth: columnWidths.noticeDate }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.noticeDate || ''}
                      onChange={(e) => handleColumnFilterChange('noticeDate', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.receivedDate, minWidth: columnWidths.receivedDate }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.receivedDate || ''}
                      onChange={(e) => handleColumnFilterChange('receivedDate', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.ageing, minWidth: columnWidths.ageing }}>
                    <Select 
                      value={columnFilters.ageing || ""} 
                      onValueChange={(val: string | null) => handleColumnFilterChange('ageing', val || '')}
                    >
                      <SelectTrigger className="h-7 text-[10px] bg-white px-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="green">On Track (Green)</SelectItem>
                        <SelectItem value="yellow">Warning (Yellow)</SelectItem>
                        <SelectItem value="red">Overdue (Red)</SelectItem>
                        <SelectItem value="black">Dispatched (Black)</SelectItem>
                        <SelectItem value="slate">Closed (Slate)</SelectItem>
                        <SelectItem value="purple">Hold (Purple)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.fro, minWidth: columnWidths.fro }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.fro || ''}
                      onChange={(e) => handleColumnFilterChange('fro', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.to, minWidth: columnWidths.to }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.to || ''}
                      onChange={(e) => handleColumnFilterChange('to', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.borrowerName, minWidth: columnWidths.borrowerName }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.borrowerName || ''}
                      onChange={(e) => handleColumnFilterChange('borrowerName', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.pos, minWidth: columnWidths.pos }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.pos || ''}
                      onChange={(e) => handleColumnFilterChange('pos', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.tos, minWidth: columnWidths.tos }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.tos || ''}
                      onChange={(e) => handleColumnFilterChange('tos', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.dsSbRemarks, minWidth: columnWidths.dsSbRemarks }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.dsSbRemarks || ''}
                      onChange={(e) => handleColumnFilterChange('dsSbRemarks', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.assignedTo, minWidth: columnWidths.assignedTo }}>
                    <Select 
                      value={columnFilters.assignedTo || ""} 
                      onValueChange={(val: string | null) => handleColumnFilterChange('assignedTo', val === 'all' || !val ? '' : val)}
                    >
                      <SelectTrigger className="h-7 text-[10px] bg-white px-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {agents.map((agent: any) => (
                          <SelectItem key={agent.id} value={agent.name}>{agent.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.actionToBeTaken, minWidth: columnWidths.actionToBeTaken }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.actionToBeTaken || ''}
                      onChange={(e) => handleColumnFilterChange('actionToBeTaken', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.comments, minWidth: columnWidths.comments }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.comments || ''}
                      onChange={(e) => handleColumnFilterChange('comments', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.dispatchStatus, minWidth: columnWidths.dispatchStatus }}>
                    <Select 
                      value={columnFilters.dispatchStatus || ""} 
                      onValueChange={(val: string | null) => handleColumnFilterChange('dispatchStatus', val === 'all' || !val ? '' : val)}
                    >
                      <SelectTrigger className="h-7 text-[10px] bg-white px-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Dispatched">Dispatched</SelectItem>
                        <SelectItem value="Hold">Hold</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.dispatchedDate, minWidth: columnWidths.dispatchedDate }}></TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.priority, minWidth: columnWidths.priority }}>
                    <Select 
                      value={columnFilters.priority || ""} 
                      onValueChange={(val: string | null) => handleColumnFilterChange('priority', val || '')}
                    >
                      <SelectTrigger className="h-7 text-[10px] bg-white px-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.company, minWidth: columnWidths.company }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.company || ''}
                      onChange={(e) => handleColumnFilterChange('company', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.pool, minWidth: columnWidths.pool }}>
                    <Select 
                      value={columnFilters.pool || ""} 
                      onValueChange={(val: string | null) => handleColumnFilterChange('pool', val === 'all' || !val ? '' : val)}
                    >
                      <SelectTrigger className="h-7 text-[10px] bg-white px-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="POOL-1">POOL-1</SelectItem>
                        <SelectItem value="POOL-2">POOL-2</SelectItem>
                        <SelectItem value="POOL-3">POOL-3</SelectItem>
                        <SelectItem value="POOL-4">POOL-4</SelectItem>
                        <SelectItem value="POOL-5">POOL-5</SelectItem>
                        <SelectItem value="POOL-6">POOL-6</SelectItem>
                        <SelectItem value="POOL-7">POOL-7</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.arbitrators, minWidth: columnWidths.arbitrators }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.arbitrators || ''}
                      onChange={(e) => handleColumnFilterChange('arbitrators', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="border-r px-2 py-1" style={{ width: columnWidths.arbitrationStatus, minWidth: columnWidths.arbitrationStatus }}>
                    <Input 
                      placeholder="Filter..." 
                      className="h-7 text-[10px] bg-white" 
                      value={columnFilters.arbitrationStatus || ''}
                      onChange={(e) => handleColumnFilterChange('arbitrationStatus', e.target.value)}
                    />
                  </TableHead>
                  <TableHead className="px-2 py-1" style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}></TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {paginatedCases.map((item) => (
                  <CaseRow 
                    key={item.id}
                    item={item}
                    isAgent={isAgent}
                    selectedIds={selectedIds}
                    toggleSelect={toggleSelect}
                    columnWidths={columnWidths}
                    handleFieldUpdate={handleFieldUpdate}
                    handleStartEdit={handleStartEdit}
                    agents={agents}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
        
        {/* Movement Bar / Summary Bar */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground z-10 w-full overflow-x-auto">
          <div className="flex items-center gap-4 shrink-0">
            <span>Total Cases: <strong>{filteredCases.length}</strong></span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Overdue: <strong>{filteredCases.filter(c => {
                const ageing = calculateAgeing(c.receivedDate);
                return ageing !== null && ageing > 7 && c.dispatchStatus !== 'Dispatched' && c.dispatchStatus !== 'Closed';
              }).length}</strong>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" /> On Track: <strong>{filteredCases.filter(c => calculateAgeing(c.receivedDate)! <= 3).length}</strong>
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 pr-4 pl-4 border-l ml-4 h-full">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="font-semibold text-slate-700 min-w-[80px] text-center">
              Page {validCurrentPage} of {Math.max(1, totalPages)}
             </span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage >= totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline">Scroll Progress</span>
            <div className="h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-primary transition-all duration-150 ease-out" 
                style={{ width: `${scrollProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// End of file
