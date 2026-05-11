import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { to, agentName, caseDetails } = await req.json();

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

    // Dynamic transport selection
    let transportConfig: any = {};
    const lowerUser = user.toLowerCase();

    if (lowerUser.includes('@gmail.com')) {
      transportConfig = {
        service: 'gmail',
        auth: {
          user: user,
          pass: pass,
        },
      };
    } else if (lowerUser.includes('@outlook.com') || lowerUser.includes('@hotmail.com') || lowerUser.includes('@live.com') || lowerUser.includes('@msn.com')) {
      transportConfig = {
        service: 'Outlook365',
        auth: {
          user: user,
          pass: pass,
        },
      };
    } else {
      // Default / Office 365 / Customized domains
      transportConfig = {
        host: 'smtp.office365.com',
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: user,
          pass: pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      };
    }

    const transporter = nodemailer.createTransport({
      ...transportConfig,
      // Global timeouts
      connectionTimeout: 10000, 
      greetingTimeout: 10000,
      socketTimeout: 20000,
      debug: true, // Enable debug logging for better troubleshooting
      logger: true
    });

    const mailOptions = {
      from: `"System Administrative" <${user}>`,
      to: to,
      cc: "supriya@indialaw.in",
      subject: `New Case Assignment: ${caseDetails.agmtNo}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #2563eb;">New Case Assignment</h2>
          <p>Hello <strong>${agentName}</strong>,</p>
          <p>A new matter has been assigned to you. Please find the details below:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Agreement No:</strong> ${caseDetails.agmtNo}</p>
            <p style="margin: 5px 0;"><strong>Borrower Name:</strong> ${caseDetails.borrowerName}</p>
            <p style="margin: 5px 0;"><strong>Company:</strong> ${caseDetails.company}</p>
            <p style="margin: 5px 0;"><strong>Arbitration status:</strong> ${caseDetails.arbitrationStatus || 'Not specified'}</p>
          </div>
          <p>Please log in to the dashboard to view more details and start working on this case.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280;">This is an automated notification from the System Administrative office.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    
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
