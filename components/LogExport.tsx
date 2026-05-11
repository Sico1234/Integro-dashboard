'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Calendar as CalendarIcon } from "lucide-react";
import { useFirebase } from "@/components/FirebaseProvider";
import * as XLSX from 'xlsx';
import { buttonVariants } from "@/components/ui/button";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { calculateAgeing } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

export function LogExport() {
  const { cases } = useFirebase();
  const [date, setDate] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const exportToExcel = () => {
    const toastId = toast.loading("Preparing export...");
    try {
      if (!date?.from || !date?.to) {
        toast.error("Please select a complete date range", { id: toastId });
        return;
      }

      console.log("Exporting cases for range:", date.from, "to", date.to);

      const filteredCases = cases.filter(c => {
        if (!c.receivedDate) return false;
        try {
          const receivedDate = c.receivedDate.toDate();
          const start = startOfDay(date.from!);
          const end = endOfDay(date.to!);
          return isWithinInterval(receivedDate, { start, end });
        } catch (e) {
          console.error("Error checking date for case:", c.id, e);
          return false;
        }
      });

      if (filteredCases.length === 0) {
        toast.error("No cases found in the selected date range.", { id: toastId });
        return;
      }

      const data = filteredCases.map(c => ({
        'Unique ID': c.uniqueId || '',
        'Agmt No.': c.agmtNo || '',
        'Notice Date': c.noticeDate ? format(c.noticeDate.toDate(), 'dd-MM-yyyy') : '',
        'Received Date': c.receivedDate ? format(c.receivedDate.toDate(), 'dd-MM-yyyy') : '',
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
        'Dispatch Date': c.dispatchedDate ? format(c.dispatchedDate.toDate(), 'dd-MM-yyyy') : '',
        'Company': c.company || '',
        'Priority': c.priority || 'Medium',
        'Arbitration Status': c.arbitrationStatus || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cases Log");
      
      const fileName = `Case_Log_${format(date.from, 'dd-MM-yyyy')}_to_${format(date.to, 'dd-MM-yyyy')}.xlsx`;
      
      // Use XLSX.write and manual blob creation for better iframe compatibility
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

      toast.success(`Successfully exported ${filteredCases.length} cases`, { id: toastId });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred during export. Please check the console.", { id: toastId });
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline' }), "gap-2")}
      >
        <Download className="h-4 w-4" /> Export Logs
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Select Date Range</h4>
            <p className="text-sm text-muted-foreground">
              Choose the received date range for export.
            </p>
          </div>
          <div className="grid gap-2">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
            <div className="border-t pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setDate({ from: undefined, to: undefined })}
              >
                Clear Range
              </Button>
            </div>
          </div>
          <Button 
            onClick={exportToExcel} 
            className="w-full gap-2"
            disabled={!date?.from || !date?.to}
          >
            <Download className="h-4 w-4" />
            Download {date?.from && date?.to ? `(${format(date.from, 'dd-MM')} - ${format(date.to, 'dd-MM')})` : ''}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
