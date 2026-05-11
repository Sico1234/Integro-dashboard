'use client';

import { useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { sendBulkAssignmentEmail } from '@/lib/email-utils';
import { useFirebase } from '@/components/FirebaseProvider';
import { normalizeDate, formatDate } from '@/lib/utils';

import { BulkActionDialog } from './BulkActionDialog';

export function BulkAssignCases() {
  const { agents, cases } = useFirebase();

  const handleDownloadTemplate = () => {
    const headers = ['Agmt No.', 'Notice Date', 'Assigned To'];
    const data = [headers];
    
    // Optional: Pre-fill with existing data? No, let's keep it simple as a template
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Bulk_Assign_Template.xlsx");
  };

  const onProcessFile = async (jsonData: any[]) => {
    if (jsonData.length === 0) {
      throw new Error("No data found in the file");
    }

    // 1. Get all Agmt No.s
    const excelAgmtNos = jsonData
      .map(row => String(row['Agmt No.'] || row['agmtNo'] || row['Case ID'] || '').trim())
      .filter(Boolean);

    if (excelAgmtNos.length === 0) {
      throw new Error("No 'Agmt No.' column found in the Excel file");
    }

    // Perform bulk assign using local cases
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    let batch = writeBatch(db);
    let operationCount = 0;
    
    // Group assignments by agent for bulk notification
    const assignmentsByAgent: Record<string, { agent: any, cases: any[] }> = {};

    for (const row of jsonData) {
      const agmtNo = String(row['Agmt No.'] || row['agmtNo'] || row['Case ID'] || '').trim();
      const agentName = String(row['Assigned To'] || row['assignedTo'] || '').trim();
      
      const excelNoticeDateRaw = row['Notice Date'] || row['noticeDate'];
      const excelNoticeDateStr = excelNoticeDateRaw ? formatDate(normalizeDate(excelNoticeDateRaw)) : null;

      // Find matched case
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

      if (caseItem && agentName) {
        try {
          const docRef = doc(db, 'cases', caseItem.id);
          batch.update(docRef, { assignedTo: agentName });
          operationCount++;
          successCount++;

          // Track for bulk email
          const agent = agents.find(a => a.name.toLowerCase().trim() === agentName.toLowerCase().trim());
          if (agent?.email) {
            if (!assignmentsByAgent[agent.name]) {
              assignmentsByAgent[agent.name] = { agent, cases: [] };
            }
            assignmentsByAgent[agent.name].cases.push({ ...caseItem, assignedTo: agentName });
          }

          results.push({ ...row, Status: 'Success' });

          if (operationCount >= 500) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        } catch (err: any) {
          errorCount++;
          results.push({ ...row, Status: 'Failed', Reason: err.message });
        }
      } else {
        errorCount++;
        results.push({ 
          ...row, 
          Status: 'Failed', 
          Reason: !agmtNo ? 'Missing Agmt No.' : (!caseItem ? 'Case not found' : 'Missing Agent Name') 
        });
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    // Send bulk notifications after batch completion
    for (const agentName in assignmentsByAgent) {
      const { agent, cases } = assignmentsByAgent[agentName];
      // Only send bulk if there are multiple cases, or just send bulk for consistency
      await sendBulkAssignmentEmail(agent.email, agent.name, cases);
    }

    return { successCount, errorCount, results };
  };

  return (
    <BulkActionDialog
      title="Bulk update cases"
      description="Follow the steps below to assign cases to agents in bulk."
      triggerButton={
        <Button variant="outline" className="gap-2 h-9">
          <UserPlus className="h-4 w-4" /> 
          Bulk Assign
        </Button>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onProcessFile={onProcessFile}
      templateFileName="Bulk_Assign_Template.xlsx"
      resultsFileName="Bulk_Assign_Results.xlsx"
    />
  );
}
