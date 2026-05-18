'use client';

import { writeBatch, doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { db } from '@/lib/firebase';
import { sendBulkAssignmentEmail } from '@/lib/email-utils';
import { useFirebase } from '@/components/FirebaseProvider';
import { normalizeDate, formatDate } from '@/lib/utils';

import { BulkActionDialog } from './BulkActionDialog';

export function BulkAssignCases() {
  const { agents, cases, user } = useFirebase();
  const isAdmin = user?.role === 'admin';

  // Only admins can access bulk assign. Agents/users should never see or run this.
  if (!isAdmin) {
    return null;
  }

  const handleDownloadTemplate = () => {
    if (!isAdmin) {
      toast.error('Only admins can download the bulk assign template');
      return;
    }

    const headers = [
      'Unique ID',
      'Agmt No.',
      'Notice Date',
      'Assigned To'
    ];

    const data = [headers];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Bulk_Assign_Template.xlsx");
  };

  const onProcessFile = async (jsonData: any[]) => {
    if (!isAdmin) {
      throw new Error('Only admins can bulk assign cases');
    }

    if (jsonData.length === 0) {
      throw new Error("No data found in the file");
    }

    const hasIdentifier = jsonData.some(row => {
      const agmtNo = String(
        row['Agmt No.'] ||
        row['agmtNo'] ||
        row['Agreement No'] ||
        row['Case ID'] ||
        row['caseId'] ||
        ''
      ).trim();

      const uniqueId = String(
        row['Unique ID'] ||
        row['uniqueId'] ||
        row['Unique No'] ||
        row['uniqueNo'] ||
        row['Case Unique ID'] ||
        ''
      ).trim();

      return Boolean(agmtNo || uniqueId);
    });

    if (!hasIdentifier) {
      throw new Error("No 'Agmt No.' or 'Unique ID' column found in the Excel file");
    }

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    let batch = writeBatch(db);
    let operationCount = 0;

    // Group assignments by agent for bulk notification.
    const assignmentsByAgent: Record<string, { agent: any; cases: any[] }> = {};

    for (const row of jsonData) {
      const agmtNo = String(
        row['Agmt No.'] ||
        row['agmtNo'] ||
        row['Agreement No'] ||
        row['Case ID'] ||
        row['caseId'] ||
        ''
      ).trim();

      const excelUniqueId = String(
        row['Unique ID'] ||
        row['uniqueId'] ||
        row['Unique No'] ||
        row['uniqueNo'] ||
        row['Case Unique ID'] ||
        ''
      ).trim();

      const agentName = String(
        row['Assigned To'] ||
        row['assignedTo'] ||
        row['Agent'] ||
        row['agent'] ||
        ''
      ).trim();

      const excelNoticeDateRaw =
        row['Notice Date'] ||
        row['noticeDate'];

      const excelNoticeDateStr = excelNoticeDateRaw
        ? formatDate(normalizeDate(excelNoticeDateRaw))
        : null;

      let matchedCase: any = null;

      // ----------------------------------------
      // 1. BEST MATCH → Agmt No + Notice Date
      // ----------------------------------------
      if (agmtNo && excelNoticeDateStr) {
        matchedCase = cases.find(c => {
          const dbAgmtNo = String(c.agmtNo || '').trim();

          const dbNoticeDate = c.noticeDate
            ? formatDate(c.noticeDate)
            : '';

          return (
            dbAgmtNo.toLowerCase() === agmtNo.toLowerCase() &&
            dbNoticeDate === excelNoticeDateStr
          );
        });
      }

      // ----------------------------------------
      // 2. FALLBACK → Agmt No + Unique ID
      // ----------------------------------------
      if (!matchedCase && agmtNo && excelUniqueId) {
        matchedCase = cases.find(c => {
          const dbAgmtNo = String(c.agmtNo || '').trim();
          const dbUniqueId = String(c.uniqueId || '').trim();

          return (
            dbAgmtNo.toLowerCase() === agmtNo.toLowerCase() &&
            dbUniqueId.toLowerCase() === excelUniqueId.toLowerCase()
          );
        });
      }

      // ----------------------------------------
      // 3. FALLBACK → Unique ID only
      // ----------------------------------------
      if (!matchedCase && excelUniqueId) {
        matchedCase = cases.find(c => {
          const dbUniqueId = String(c.uniqueId || '').trim();

          return dbUniqueId.toLowerCase() === excelUniqueId.toLowerCase();
        });
      }

      // ----------------------------------------
      // 4. LAST OPTION → Agmt No only
      // ----------------------------------------
      if (!matchedCase && agmtNo) {
        matchedCase = cases.find(c => {
          const dbAgmtNo = String(c.agmtNo || '').trim();

          return dbAgmtNo.toLowerCase() === agmtNo.toLowerCase();
        });
      }

      const caseItem = matchedCase;

      const targetAgent = agents.find(
        a =>
          String(a.name || '').toLowerCase().trim() ===
          agentName.toLowerCase().trim()
      );

      if (caseItem && agentName && targetAgent) {
        try {
          const canonicalAgentName = targetAgent.name;
          const docRef = doc(db, 'cases', caseItem.id);

          batch.update(docRef, {
            assignedTo: canonicalAgentName,
          });

          operationCount++;
          successCount++;

          if (targetAgent?.email) {
            if (!assignmentsByAgent[canonicalAgentName]) {
              assignmentsByAgent[canonicalAgentName] = {
                agent: targetAgent,
                cases: [],
              };
            }

            assignmentsByAgent[canonicalAgentName].cases.push({
              ...caseItem,
              assignedTo: canonicalAgentName,
            });
          }

          results.push({
            ...row,
            Status: 'Success',
            'Matched Case ID': caseItem.uniqueId || caseItem.id || '',
            'Assigned To': canonicalAgentName,
          });

          if (operationCount >= 500) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        } catch (err: any) {
          errorCount++;
          results.push({
            ...row,
            Status: 'Failed',
            Reason: err.message,
          });
        }
      } else {
        errorCount++;

        let reason = 'Case not found';

        if (!agmtNo && !excelUniqueId) {
          reason = 'Missing Agmt No. or Unique ID';
        } else if (!caseItem) {
          reason = 'Case not found';
        } else if (!agentName) {
          reason = 'Missing Agent Name';
        } else if (!targetAgent) {
          reason = 'Agent not found';
        }

        results.push({
          ...row,
          Status: 'Failed',
          Reason: reason,
        });
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    // Send bulk notifications after batch completion.
    for (const agentName in assignmentsByAgent) {
      const { agent, cases } = assignmentsByAgent[agentName];
      await sendBulkAssignmentEmail(agent.email, agent.name, cases);
    }

    return {
      successCount,
      errorCount,
      results,
    };
  };

  return (
    <BulkActionDialog
      title="Bulk assign cases"
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
