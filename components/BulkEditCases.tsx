'use client';

import { useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { sendAssignmentEmail, sendBulkAssignmentEmail } from '@/lib/email-utils';
import { useFirebase } from '@/components/FirebaseProvider';
import { normalizeDate, formatDate } from '@/lib/utils';

import { BulkActionDialog } from './BulkActionDialog';

export function BulkEditCases() {
  const { agents, cases } = useFirebase();

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
      'Priority', 
      'Assigned To', 
      'POOL',
      'Arbitration status'
    ];
    const data = [headers];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Bulk_Edit_Template.xlsx");
  };

  const onProcessFile = async (jsonData: any[]) => {
    if (jsonData.length === 0) {
      throw new Error("No data found in the file");
    }

    // 1. Get all Agmt No.s
    const excelAgmtNos = jsonData
      .map(row => String(row['Agmt No.'] || row['agmtNo'] || row['Case ID'] || row['caseId'] || '').trim())
      .filter(Boolean);

    if (excelAgmtNos.length === 0) {
      throw new Error("No 'Agmt No.' column found in the Excel file");
    }

    const parseExcelDate = (val: any) => {
      if (!val) return null;
      const normalized = normalizeDate(val);
      if (normalized && normalized.getUTCFullYear() > 1975) return Timestamp.fromDate(normalized);
      return null;
    };

    // Remove chunk queries, we use local full list of cases
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    let batch = writeBatch(db);
    let operationCount = 0;

    // Group assignments by agent for bulk notification
    const assignmentsByAgent: Record<string, { agent: any, cases: any[] }> = {};

    for (const row of jsonData) {
      const agmtNo = String(row['Agmt No.'] || row['agmtNo'] || row['Case ID'] || row['caseId'] || '').trim();

      const excelNoticeDateRaw = row['Notice Date'] || row['noticeDate'];
      const excelNoticeDateStr = excelNoticeDateRaw ? formatDate(normalizeDate(excelNoticeDateRaw)) : null;

      // Find best match matching Agmt No and optionally Notice Date
      const matchedCase = cases.find(c => {
        const dbAgmtNo = String(c.agmtNo || '').trim();
        if (dbAgmtNo !== agmtNo) return false;

        // If notice date is specified in excel, try to match it
        if (excelNoticeDateStr) {
          const dbNoticeDateStr = c.noticeDate ? formatDate(c.noticeDate) : '-';
          return dbNoticeDateStr === excelNoticeDateStr;
        }
        return true;
      });

      const caseItem = matchedCase;

      if (caseItem) {
        try {
          const docRef = doc(db, 'cases', caseItem.id);
          const updateData: any = {};

          const updateField = (field: string, excelValue: any) => {
            const val = String(excelValue || '').trim();
            if (val && (!caseItem[field] || caseItem[field] === '-' || caseItem[field] === 'Unassigned')) {
              updateData[field] = val;
            }
          };

          const updateDateField = (field: string, excelValue: any) => {
            const d = parseExcelDate(excelValue);
            if (d && !caseItem[field]) {
              updateData[field] = d;
            }
          };

          updateField('borrowerName', row['Borrower Name'] || row['borrowerName']);
          updateField('company', row['Company'] || row['company']);
          updateField('fro', row['Fro'] || row['fro']);
          updateField('to', row['To'] || row['to']);
          updateField('pos', row['POS'] || row['pos']);
          updateField('tos', row['TOS'] || row['tos']);
          updateField('dsSbRemarks', row['DS/SB Remarks'] || row['dsSbRemarks']);
          if (updateData.dsSbRemarks) {
            updateData.dsSbRemarksDate = serverTimestamp();
          }
          updateField('comments', row['Comments'] || row['comments']);
          updateField('actionToBeTaken', row['Action to be taken'] || row['actionToBeTaken']);
          updateField('dispatchStatus', row['Dispatch Status'] || row['dispatchStatus']);
          updateField('assignedTo', row['Assigned To'] || row['assignedTo']);
          updateField('pool', row['POOL'] || row['Pool'] || row['pool']);
          updateField('arbitrationStatus', row['Arbitration status'] || row['arbitrationStatus']);
          
          if (row['Priority'] || row['priority']) {
            const p = String(row['Priority'] || row['priority']).trim();
            if (['High', 'Medium', 'Low'].includes(p) && !caseItem.priority) {
              updateData.priority = p;
            }
          }
          
          updateDateField('noticeDate', row['Notice Date'] || row['noticeDate']);
          updateDateField('receivedDate', row['Received Date'] || row['receivedDate'] || row['Date'] || row['date']);
          updateDateField('dispatchedDate', row['Dispatched Date'] || row['dispatchedDate'] || row['Dispatch Date'] || row['dispatchDate']);

          if (Object.keys(updateData).length > 0) {
            batch.update(docRef, updateData);
            operationCount++;
            successCount++;

            if (updateData.assignedTo) {
              const agent = agents.find(a => a.name.toLowerCase().trim() === updateData.assignedTo.toLowerCase().trim());
              if (agent?.email) {
                if (!assignmentsByAgent[agent.name]) {
                  assignmentsByAgent[agent.name] = { agent, cases: [] };
                }
                assignmentsByAgent[agent.name].cases.push({ ...caseItem, ...updateData });
              }
            }

            results.push({ ...row, Status: 'Success' });

            if (operationCount >= 500) {
              await batch.commit();
              batch = writeBatch(db);
              operationCount = 0;
            }
          } else {
            results.push({ ...row, Status: 'Skipped', Reason: 'No valid fields provided for update' });
          }
        } catch (err: any) {
          errorCount++;
          results.push({ ...row, Status: 'Failed', Reason: err.message });
        }
      } else {
        errorCount++;
        results.push({ ...row, Status: 'Failed', Reason: 'Case not found' });
      }
    }

    if (operationCount > 0) await batch.commit();

    // Send bulk notifications after batch completion
    for (const agentName in assignmentsByAgent) {
      const { agent, cases } = assignmentsByAgent[agentName];
      await sendBulkAssignmentEmail(agent.email, agent.name, cases);
    }

    return { successCount, errorCount, results };
  };

  return (
    <BulkActionDialog
      title="Bulk update cases"
      description="Follow the steps below to edit existing cases in bulk."
      triggerButton={
        <Button variant="outline" className="gap-2 h-9">
          <FileEdit className="h-4 w-4" /> 
          Bulk Edit
        </Button>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onProcessFile={onProcessFile}
      templateFileName="Bulk_Edit_Template.xlsx"
      resultsFileName="Bulk_Edit_Results.xlsx"
    />
  );
}
