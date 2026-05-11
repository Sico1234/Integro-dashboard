import { toast } from 'sonner';

export async function sendAssignmentEmail(agentEmail: string, agentName: string, caseDetails: any) {
  if (!agentEmail) {
    console.warn('No email found for agent:', agentName);
    toast.error(`Cannot send assignment mail: No email found for agent "${agentName}"`);
    return;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(`${baseUrl}/api/send-assignment-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: agentEmail,
        agentName,
        caseDetails: {
          agmtNo: caseDetails.agmtNo,
          borrowerName: caseDetails.borrowerName,
          company: caseDetails.company,
          arbitrationStatus: caseDetails.arbitrationStatus,
        },
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send assignment email');
      } else {
        const text = await response.text();
        console.error('Non-JSON error response:', text);
        throw new Error(`Server error (${response.status}): The system could not complete the email request. Please check if the server is healthy.`);
      }
    }
    
    console.log('Assignment email sent successfully to:', agentEmail);
  } catch (error: any) {
    console.error('Error sending assignment email:', error);
    toast.error(error.message || 'Failed to send notification email to agent');
  }
}

export async function sendOverdueEmail(agentEmail: string, agentName: string, caseDetails: any) {
  if (!agentEmail) {
    console.warn('No email found for agent:', agentName);
    toast.error(`Cannot send overdue mail: No email found for agent "${agentName}"`);
    return;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(`${baseUrl}/api/send-overdue-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: agentEmail,
        agentName,
        caseDetails: {
          agmtNo: caseDetails.agmtNo,
          borrowerName: caseDetails.borrowerName,
          company: caseDetails.company,
          receivedDate: caseDetails.receivedDate,
        },
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send overdue email');
      } else {
        const text = await response.text();
        console.error('Non-JSON error response:', text);
        throw new Error(`Server error (${response.status}): The system could not complete the overdue notification. Please check if the server is healthy.`);
      }
    }
    
    console.log('Overdue email sent successfully to:', agentEmail);
  } catch (error: any) {
    console.error('Error sending overdue email:', error);
    toast.error(error.message || 'Failed to send overdue notification email');
  }
}

export async function sendBulkAssignmentEmail(agentEmail: string, agentName: string, cases: any[]) {
  if (!agentEmail || cases.length === 0) {
    console.warn('Insufficient data to send bulk assignment mail:', { agentEmail, caseCount: cases.length });
    return;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(`${baseUrl}/api/send-bulk-assignment-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: agentEmail,
        agentName,
        cases: cases.map(c => ({
          agmtNo: c.agmtNo || '-',
          borrowerName: c.borrowerName || '-',
          company: c.company || '-',
          arbitrationStatus: c.arbitrationStatus || '-',
          receivedDate: c.receivedDate ? (c.receivedDate.toDate ? c.receivedDate.toDate().toLocaleDateString('en-GB') : new Date(c.receivedDate).toLocaleDateString('en-GB')) : '-'
        })),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send bulk assignment email');
    }
    
    console.log(`Bulk assignment email sent to ${agentName} (${cases.length} cases)`);
  } catch (error: any) {
    console.error('Error sending bulk assignment email:', error);
    toast.error(`Failed to send bulk notification to ${agentName}`);
  }
}

export async function sendHighPriorityEmail(agentEmail: string, agentName: string, caseDetails: any) {
  if (!agentEmail) {
    console.warn('No email found for agent:', agentName);
    return;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(`${baseUrl}/api/send-high-priority-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: agentEmail,
        agentName,
        caseDetails: {
          agmtNo: caseDetails.agmtNo,
          borrowerName: caseDetails.borrowerName,
          company: caseDetails.company,
          receivedDate: caseDetails.receivedDate,
          ageing: caseDetails.ageing
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send high priority email');
    }
    
    console.log('High priority warning email sent successfully to:', agentEmail);
  } catch (error: any) {
    console.error('Error sending high priority email:', error);
  }
}
