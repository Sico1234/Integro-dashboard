'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Download, Upload, FileCheck, AlertCircle, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface BulkActionDialogProps {
  title: string;
  description: string;
  triggerButton: React.ReactElement;
  onDownloadTemplate: () => void;
  onProcessFile: (data: any[]) => Promise<{ successCount: number; errorCount: number; results?: any[] }>;
  templateFileName: string;
  resultsFileName?: string;
}

export function BulkActionDialog({
  title,
  description,
  triggerButton,
  onDownloadTemplate,
  onProcessFile,
  templateFileName,
  resultsFileName = 'results.xlsx'
}: BulkActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ success: number; error: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setProcessing(true);
    setResults(null);
    setStats(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const { successCount, errorCount, results: processedResults } = await onProcessFile(jsonData);
        
        setStats({ success: successCount, error: errorCount });
        if (processedResults) {
          setResults(processedResults);
        }
        
        toast.success(`Processed ${jsonData.length} rows: ${successCount} success, ${errorCount} errors`);
      } catch (error) {
        console.error("Processing error:", error);
        toast.error("Failed to process file. Ensure the format is correct.");
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadResults = () => {
    if (!results) return;

    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    XLSX.writeFile(workbook, resultsFileName);
  };

  const reset = () => {
    setFile(null);
    setResults(null);
    setStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) reset();
    }}>
      <DialogTrigger render={triggerButton} />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Step 1 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">1</span>
              Step 1: Download template
            </h4>
            <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="w-full sm:w-auto gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          {/* Step 2 */}
          <div className="space-y-3 opacity-50">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">2</span>
              Step 2: Edit the file
            </h4>
            <p className="text-xs text-muted-foreground pl-8">
              Open the downloaded file and add/update your data following the header format.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">3</span>
              Step 3: Upload & submit changes
            </h4>
            <div className="flex flex-col gap-3 pl-8">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="h-9 cursor-pointer"
                />
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={!file || processing}
                className="w-full sm:w-auto"
              >
                {processing ? "Processing..." : "Submit"}
              </Button>
            </div>
          </div>

          {/* Step 4 */}
          <div className={cn("space-y-3 transition-opacity", !stats && "opacity-20 pointer-events-none")}>
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">4</span>
              Step 4: View results
            </h4>
            <div className="flex flex-col gap-3 pl-8">
              {stats && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <FileCheck className="h-3 w-3" /> {stats.success} Success
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-3 w-3" /> {stats.error} Errors
                  </span>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadResults} 
                className="w-full sm:w-auto gap-2"
                disabled={!results}
              >
                <FileDown className="h-4 w-4" />
                Download results
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
