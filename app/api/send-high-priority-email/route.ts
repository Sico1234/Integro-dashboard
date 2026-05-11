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
      connectionTimeout: 10000, 
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    const mailOptions = {
      from: `"System Administrative" <${user}>`,
      to: to,
      cc: "supriya@indialaw.in",
      subject: `CRITICAL: Case Auto-Escalated to HIGH PRIORITY - ${caseDetails.agmtNo}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: auto; border: 2px solid #ef4444; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">Critical Alert</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">System Auto-Escalation</p>
          </div>
          <div style="padding: 30px;">
            <p>Hello <strong>${agentName}</strong>,</p>
            <p>The following case has been pending for <strong>${caseDetails.ageing} days</strong> and has reached the critical threshold.</p>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 5px solid #ef4444; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #b91c1c;">Case Automatically Escalated to HIGH PRIORITY</h3>
              <p style="margin: 8px 0; font-size: 14px;"><strong>Agreement No:</strong> ${caseDetails.agmtNo}</p>
              <p style="margin: 8px 0; font-size: 14px;"><strong>Borrower Name:</strong> ${caseDetails.borrowerName}</p>
              <p style="margin: 8px 0; font-size: 14px;"><strong>Company:</strong> ${caseDetails.company}</p>
              <p style="margin: 8px 0; font-size: 14px;"><strong>Ageing:</strong> <span style="color: #ef4444; font-weight: bold;">${caseDetails.ageing} Days</span></p>
            </div>
            
            <p><strong>Required Action:</strong> This case now requires immediate attention. Please process the documents and update the status within the next 24 hours.</p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
              This is a system-generated critical warning message. Continuous delays in high-priority cases are being monitored.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending high priority email:', error);
    
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
