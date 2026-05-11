import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const { to, agentName, cases } = await req.json();

    const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
    const pass = "India@0605";

    if (!user || !pass) {
      const missing = [];
      if (!user) missing.push('EMAIL_USER');
      if (!pass) missing.push('EMAIL_PASS');
      console.error(`Email configuration missing: ${missing.join(', ')}`);
      return NextResponse.json({ 
        error: `Email configuration missing: ${missing.join(', ')}`,
        help: "Please set these environment variables in the Settings menu (AI Studio) or in your local .env file."
      }, { status: 500 });
    }

    // Dynamic transport selection (same as send-assignment-email)
    let transportConfig: any = {};
    const lowerUser = user.toLowerCase();

    if (lowerUser.includes('@gmail.com')) {
      transportConfig = {
        service: 'gmail',
        auth: { user, pass },
      };
    } else if (lowerUser.includes('@outlook.com') || lowerUser.includes('@hotmail.com') || lowerUser.includes('@live.com') || lowerUser.includes('@msn.com')) {
      transportConfig = {
        service: 'Outlook365',
        auth: { user, pass },
      };
    } else {
      transportConfig = {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user, pass },
        tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
      };
    }

    const transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 10000, 
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    // Generate Excel Buffer
    const worksheet = XLSX.utils.json_to_sheet(cases.map((c: any) => ({
      'Agreement No': c.agmtNo,
      'Borrower Name': c.borrowerName,
      'Company': c.company,
      'Arbitration Status': c.arbitrationStatus,
      'Received Date': c.receivedDate
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assigned Cases");
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const mailOptions = {
      from: `"System Administrative" <${user}>`,
      to: to,
      cc: "supriya@indialaw.in",
      subject: `Bulk Case Assignment Notification: ${cases.length} Matters`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #2563eb;">Bulk Case Assignment</h2>
          <p>Hello <strong>${agentName}</strong>,</p>
          <p>You have been assigned <strong>${cases.length}</strong> new cases in bulk.</p>
          <p>We have attached an Excel sheet containing the full list of assigned cases for your reference.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Total Items:</strong> ${cases.length}</p>
            <p style="margin: 5px 0;"><strong>Notification Type:</strong> Bulk Assignment</p>
          </div>
          <p>Please log in to the dashboard to view more details and start working on these cases.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280;">This is an automated notification from the System Administrative office. Please find the attached file for details.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Assigned_Cases_${new Date().getTime()}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending bulk assignment email:', error);
    
    let errorMessage = 'Failed to send email';
    if (error.message?.includes('SmtpClientAuthentication is disabled')) {
      errorMessage = 'SMTP is disabled for your Outlook account. Please enable "Authenticated SMTP" in Microsoft 365 Admin Center for this user.';
    } else if (error.message?.includes('Invalid login') || error.message?.includes('535 5.7.3')) {
      errorMessage = 'Authentication failed. Please check your credentials. Verify that your username and password are correct. For Outlook, also ensure "Authenticated SMTP" is enabled in the Admin Center.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timed out. The SMTP server took too long to respond. This can happen if the credentials are being rejected or the server is busy.';
    }

    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
