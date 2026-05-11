'use client';

import { useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/components/FirebaseProvider';
import { generateUniqueId, normalizeDate } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { BulkActionDialog } from './BulkActionDialog';

export function ImportCases() {
  const { getNextCaseCounter } = useFirebase();

  const handleDownloadTemplate = () => {
    const headers = [
      'Agmt No.', 
      'Borrower Name', 
      'Company', 
      'Notice Date', 
      'Received Date', 
      'Fro', 
      'To', 
      'POS', 
      'TOS', 
      'DS/SB Remarks', 
      'Action to be taken', 
      'Comments', 
      'Dispatch Status', 
      'Dispatched Date', 
      'POOL',
      'Arbitration status'
    ];
    const data = [headers];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Import_Cases_Template.xlsx");
  };

  const onProcessFile = async (jsonData: any[]) => {
    if (jsonData.length === 0) {
      throw new Error("No data found in the file");
    }

    // Helper to find value by multiple possible header names
    const findValue = (row: any, possibleHeaders: string[]) => {
      const rowKeys = Object.keys(row);
      for (const header of possibleHeaders) {
        if (row[header] !== undefined) return row[header];
        const match = rowKeys.find(k => k.trim().toLowerCase() === header.toLowerCase());
        if (match) return row[match];
      }
      return '';
    };

    const headerMap = {
      agmtNo: ['Agmt No.', 'Agreement No', 'Agreement Number', 'Case ID', 'ID', 'agmtNo'],
      borrowerName: ['Borrower Name', 'Name', 'Customer Name', 'Client Name', 'borrowerName'],
      company: ['Company', 'Company Name', 'Organization', 'company'],
      noticeDate: ['Notice Date', 'Notice', 'noticeDate'],
      receivedDate: ['Received Date', 'Date', 'Entry Date', 'receivedDate'],
      fro: ['Fro', 'From', 'fro'],
      to: ['To', 'to'],
      pos: ['POS', 'Principal Outstanding', 'pos'],
      tos: ['TOS', 'Total Outstanding', 'tos'],
      dsSbRemarks: ['DS/SB Remarks', 'Remarks', 'dsSbRemarks'],
      actionToBeTaken: ['Action to be taken', 'Action', 'actionToBeTaken'],
      comments: ['Comments', 'Notes', 'comments'],
      dispatchStatus: ['Dispatch Status', 'Dispatch', 'dispatchStatus'],
      dispatchedDate: ['Dispatched Date', 'Dispatch Date', 'dispatchedDate'],
      pool: ['Pool', 'POOL', 'pool'],
      arbitrationStatus: ['Arbitration status', 'Arbitration', 'arbitrationStatus']
    };

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    const validRows = jsonData.filter(row => {
      const agmtNo = String(findValue(row, headerMap.agmtNo));
      const borrowerName = String(findValue(row, headerMap.borrowerName));
      return agmtNo && borrowerName;
    });

    let currentCounter = await getNextCaseCounter(validRows.length);

    for (const row of jsonData) {
      try {
        const agmtNo = String(findValue(row, headerMap.agmtNo));
        const borrowerName = String(findValue(row, headerMap.borrowerName));

        if (!agmtNo || !borrowerName) {
          results.push({ ...row, Status: 'Failed', Reason: 'Missing Agmt No. or Borrower Name' });
          errorCount++;
          continue;
        }

        const uniqueId = generateUniqueId(currentCounter++);

        const parseExcelDate = (val: any) => {
          if (!val) return null;
          const normalized = normalizeDate(val);
          if (normalized && normalized.getUTCFullYear() > 1975) {
            return Timestamp.fromDate(normalized);
          }
          return null;
        };

        const receivedDate = parseExcelDate(findValue(row, headerMap.receivedDate));
        const noticeDate = parseExcelDate(findValue(row, headerMap.noticeDate));
        const dispatchedDate = parseExcelDate(findValue(row, headerMap.dispatchedDate));

        const caseData = {
          agmtNo: String(agmtNo),
          uniqueId: uniqueId,
          borrowerName: String(borrowerName),
          company: String(findValue(row, headerMap.company)),
          noticeDate,
          receivedDate,
          fro: String(findValue(row, headerMap.fro)),
          to: String(findValue(row, headerMap.to)),
          pos: String(findValue(row, headerMap.pos)),
          tos: String(findValue(row, headerMap.tos)),
          dsSbRemarks: String(findValue(row, headerMap.dsSbRemarks)),
          dsSbRemarksDate: findValue(row, headerMap.dsSbRemarks) ? serverTimestamp() : null,
          actionToBeTaken: String(findValue(row, headerMap.actionToBeTaken)),
          comments: String(findValue(row, headerMap.comments)),
          dispatchStatus: String(findValue(row, headerMap.dispatchStatus) || 'Pending'),
          dispatchedDate,
          pool: String(findValue(row, headerMap.pool)),
          arbitrationStatus: String(findValue(row, headerMap.arbitrationStatus)),
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'cases'), caseData);
        successCount++;
        results.push({ ...row, Status: 'Success', 'Assigned Unique ID': uniqueId });
      } catch (err: any) {
        console.error("Error importing row:", err);
        errorCount++;
        results.push({ ...row, Status: 'Failed', Reason: err.message });
      }
    }

    return { successCount, errorCount, results };
  };

  return (
    <BulkActionDialog
      title="Bulk update cases"
      description="Follow the steps below to import new cases into the system."
      triggerButton={
        <Button variant="outline" className="gap-2 h-9">
          <Upload className="h-4 w-4" /> 
          Import Cases
        </Button>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onProcessFile={onProcessFile}
      templateFileName="Import_Cases_Template.xlsx"
      resultsFileName="Import_Results.xlsx"
    />
  );
}
