'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { useFirebase } from '@/components/FirebaseProvider';
import { normalizeDate, formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';

import { BulkActionDialog } from './BulkActionDialog';

export function SyncUniqueIdDialog() {
  const { cases } = useFirebase();

  const handleDownloadTemplate = () => {
    const headers = [
      'Sr No.', 
      'Agreement No.', 
      'Notice Date'
    ];
    const data = [headers];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Sync_Unique_ID_Template.xlsx");
  };

  const onProcessFile = async (jsonData: any[]) => {
    if (jsonData.length === 0) {
      throw new Error("No data found in the file");
    }

    // Helper to find value by multiple possible header names
    const findValue = (row: any, possibleHeaders: string[]) => {
      const rowKeys = Object.keys(row);
      for (const header of possibleHeaders) {
        if (row[header] !== undefined && row[header] !== null && row[header] !== '') return row[header];
        
        // Loose matching: remove all spaces, dots, and underscores for comparison
        const normalizedHeader = header.toLowerCase().replace(/[\.\s_]/g, '');
        const match = rowKeys.find(k => k.toLowerCase().replace(/[\.\s_]/g, '') === normalizedHeader);
        
        if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') {
          return row[match];
        }
      }
      return '';
    };

    const headerMap = {
      srNo: ['Sr No', 'Unique ID', 'Id', 'srNo'], // The normalized comparison will match "Sr. No.", "Sr No.", "SR NO", etc.
      agmtNo: ['Agmt No', 'Agreement No', 'Agreement Number', 'agmtNo'],
      noticeDate: ['Notice Date', 'Notice', 'noticeDate'],
    };

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const row of jsonData) {
      try {
        const rawSrNo = findValue(row, headerMap.srNo);
        const rawAgmtNo = findValue(row, headerMap.agmtNo);
        
        const srNo = String(rawSrNo).trim();
        const agmtNo = String(rawAgmtNo).trim();

        // Skip if everything indicates an empty row (blank trailing rows in excel)
        if (!srNo && !agmtNo && !findValue(row, headerMap.noticeDate)) {
          continue;
        }

        if (!srNo || !agmtNo || srNo === 'undefined' || agmtNo === 'undefined') {
          results.push({ ...row, Status: 'Failed', Reason: `Missing Sr No. or Agreement No. (Found SrNo: '${rawSrNo}', AgmtNo: '${rawAgmtNo}')` });
          errorCount++;
          continue;
        }

        const excelNoticeDateRaw = findValue(row, headerMap.noticeDate);
        const excelNoticeDateStr = excelNoticeDateRaw ? formatDate(normalizeDate(excelNoticeDateRaw)) : '-';

        // Find matching case
        const matchedCase = cases.find(c => {
          const dbAgmtNo = String(c.agmtNo || '').trim();
          if (dbAgmtNo !== agmtNo) return false;

          // If there's an excel notice date, we should match it
          if (excelNoticeDateRaw) {
            const dbNoticeDateStr = c.noticeDate ? formatDate(c.noticeDate) : '-';
            return dbNoticeDateStr === excelNoticeDateStr;
          }
          
          return true; // Match by agmtNo alone if Notice Date not specified
        });

        if (matchedCase) {
          const docRef = doc(db, 'cases', matchedCase.id);
          batch.update(docRef, { uniqueId: srNo });
          operationCount++;
          successCount++;
          results.push({ ...row, Status: 'Success', 'Updated Unique ID': srNo });

          if (operationCount >= 500) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        } else {
          errorCount++;
          results.push({ ...row, Status: 'Failed', Reason: 'Case not found matching Agmt No & Notice Date' });
        }
      } catch (err: any) {
        console.error("Error processing row:", err);
        errorCount++;
        results.push({ ...row, Status: 'Failed', Reason: err.message });
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    return { successCount, errorCount, results };
  };

  return (
    <BulkActionDialog
      title="Sync Unique IDs / Sr No."
      description="Upload an Excel file to replace the Unique ID of existing cases by matching Agreement No. and optionally Notice Date."
      triggerButton={
        <Button variant="outline" className="gap-2 h-9 text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:text-purple-700">
          <RefreshCw className="h-4 w-4" /> 
          Sync IDs
        </Button>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onProcessFile={onProcessFile}
      templateFileName="Sync_Unique_ID_Template.xlsx"
      resultsFileName="Sync_Results.xlsx"
    />
  );
}
