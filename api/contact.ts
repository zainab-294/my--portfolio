import type { IncomingMessage, ServerResponse } from 'node:http';
import { Resend } from 'resend';

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
  body?: any;
}

export interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (jsonBody: any) => VercelResponse;
  send: (body: any) => VercelResponse;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getOwnerEmail(): string {
  const envEmail = process.env.CONTACT_TO_EMAIL;
  if (!envEmail || envEmail.includes('example.com')) {
    return 'thecodergirly@gmail.com';
  }
  return envEmail.trim();
}

function getResendSender(): string {
  const customFrom = process.env.RESEND_FROM_EMAIL;
  if (customFrom && !customFrom.includes('example.com')) {
    return customFrom.trim();
  }
  return 'Zainab <onboarding@resend.dev>';
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('re_placeholder') || apiKey.includes('your-resend-api-key')) {
    return null;
  }
  return new Resend(apiKey.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { name, email, message } = body;

    // 1. Validation
    const errors: Record<string, string> = {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.name = 'Please provide your name (at least 2 characters).';
    } else if (name.trim().length > 60) {
      errors.name = 'Name must be 60 characters or fewer.';
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    } else if (email.trim().length > 100) {
      errors.email = 'Email must be 100 characters or fewer.';
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters long.';
    } else if (message.trim().length > 1000) {
      errors.message = 'Message cannot exceed 1,000 characters.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed on submitted data.',
        validationErrors: errors,
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    const safeName = sanitizeText(trimmedName);
    const safeEmail = sanitizeText(trimmedEmail);
    const safeMessage = sanitizeText(trimmedMessage);

    const submissionDateObj = new Date();
    const submissionDate = submissionDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const submissionTime = submissionDateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      timeZone: 'UTC',
    });
    const submissionIso = submissionDateObj.toISOString();

    const ownerEmail = getOwnerEmail();
    const fromAddress = getResendSender();

    const ownerEmailSubject = `New Portfolio Message from ${safeName}`;
    const ownerEmailText = [
      'You have received a new message through your portfolio contact form!',
      '',
      'SUBMISSION DETAILS:',
      `• Name: ${trimmedName}`,
      `• Email: ${trimmedEmail}`,
      `• Submission Date: ${submissionDate}`,
      `• Submission Time: ${submissionTime} (${submissionIso})`,
      '',
      'MESSAGE:',
      '--------------------------------------------------',
      trimmedMessage,
      '--------------------------------------------------',
      '',
      `You can reply directly to this email to contact ${trimmedName} at ${trimmedEmail}.`,
    ].join('\n');

    const ownerEmailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1E0A24; max-width: 600px; margin: 0 auto; border: 1px solid #EEDBEE; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #8E1EA2; color: #ffffff; padding: 24px; text-align: left;">
          <p style="margin: 0 0 4px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">Portfolio Contact Notification</p>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">New Message from ${safeName}</h1>
        </div>
        <div style="padding: 28px 24px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <tbody>
              <tr style="border-bottom: 1px solid #F1E4F2;">
                <td style="padding: 10px 0; font-weight: 600; color: #7A5785; width: 140px;">Visitor Name:</td>
                <td style="padding: 10px 0; color: #1E0A24; font-weight: 500;">${safeName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #F1E4F2;">
                <td style="padding: 10px 0; font-weight: 600; color: #7A5785;">Visitor Email:</td>
                <td style="padding: 10px 0;"><a href="mailto:${safeEmail}" style="color: #8E1EA2; text-decoration: none; font-weight: 500;">${safeEmail}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #F1E4F2;">
                <td style="padding: 10px 0; font-weight: 600; color: #7A5785;">Submission Date:</td>
                <td style="padding: 10px 0; color: #1E0A24;">${submissionDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 600; color: #7A5785;">Submission Time:</td>
                <td style="padding: 10px 0; color: #1E0A24;">${submissionTime} <span style="font-size: 12px; color: #9E80A8;">(${submissionIso})</span></td>
              </tr>
            </tbody>
          </table>

          <p style="margin: 0 0 10px 0; font-weight: 600; color: #1E0A24; font-size: 15px;">Message Content:</p>
          <div style="background-color: #FAF7FB; border-left: 4px solid #8E1EA2; padding: 16px 20px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #2C1236; line-height: 1.6;">${safeMessage}</div>

          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #F1E4F2;">
            <a href="mailto:${safeEmail}" style="display: inline-block; background-color: #8E1EA2; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px;">Reply to ${safeName}</a>
          </div>
        </div>
        <div style="background-color: #FAF7FB; padding: 14px 24px; font-size: 12px; color: #7A5785; border-top: 1px solid #EEDBEE;">
          Delivered to ${ownerEmail} via Zainab's Developer Portfolio.
        </div>
      </div>
    `;

    const visitorEmailSubject = `Thank you for reaching out, ${safeName}!`;
    const visitorEmailText = [
      `Hi ${trimmedName},`,
      '',
      'Thank you for reaching out through my portfolio website!',
      '',
      "I've successfully received your message and appreciate you taking the time to contact me. I'll review your message and get back to you as soon as possible.",
      '',
      'I look forward to connecting with you!',
      '',
      'Best regards,',
      'Zainab',
      'Web Developer',
    ].join('\n');

    const visitorEmailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1E0A24; max-width: 600px; margin: 0 auto; border: 1px solid #EEDBEE; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #8E1EA2; color: #ffffff; padding: 24px; text-align: left;">
          <p style="margin: 0 0 4px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">Message Confirmation</p>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Thank You for Reaching Out!</h1>
        </div>
        <div style="padding: 28px 24px; font-size: 15px; color: #1E0A24; line-height: 1.7;">
          <p style="margin: 0 0 16px 0;">Hi ${safeName},</p>
          <p style="margin: 0 0 16px 0;">Thank you for reaching out through my portfolio website!</p>
          <p style="margin: 0 0 16px 0;">I've successfully received your message and appreciate you taking the time to contact me. I'll review your message and get back to you as soon as possible.</p>
          <p style="margin: 0 0 24px 0;">I look forward to connecting with you!</p>
          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #F1E4F2;">
            <p style="margin: 0; font-size: 15px; color: #1E0A24; font-weight: 600;">Best regards,</p>
            <p style="margin: 4px 0 0 0; font-size: 15px; color: #8E1EA2; font-weight: 700;">Zainab</p>
            <p style="margin: 2px 0 0 0; font-size: 13px; color: #7A5785;">Web Developer</p>
          </div>
        </div>
        <div style="background-color: #FAF7FB; padding: 14px 24px; font-size: 12px; color: #7A5785; border-top: 1px solid #EEDBEE;">
          Sent automatically from Zainab (<a href="mailto:${ownerEmail}" style="color: #8E1EA2;">${ownerEmail}</a>).
        </div>
      </div>
    `;

    const resend = getResendClient();

    if (!resend) {
      return res.status(503).json({
        success: false,
        error: 'Resend email service is currently not configured on Vercel. Please set RESEND_API_KEY in your Vercel project environment variables.',
        notConfigured: true,
      });
    }

    const ownerSendResult = await resend.emails.send({
      from: fromAddress,
      to: [ownerEmail],
      replyTo: trimmedEmail,
      subject: ownerEmailSubject,
      text: ownerEmailText,
      html: ownerEmailHtml,
    });

    if (ownerSendResult.error) {
      return res.status(502).json({
        success: false,
        error: `Resend delivery failed: ${ownerSendResult.error.message || 'Unable to deliver message.'}`,
      });
    }

    let visitorWarning: string | null = null;
    try {
      const visitorSendResult = await resend.emails.send({
        from: fromAddress,
        to: [trimmedEmail],
        replyTo: ownerEmail,
        subject: visitorEmailSubject,
        text: visitorEmailText,
        html: visitorEmailHtml,
      });

      if (visitorSendResult.error) {
        visitorWarning = visitorSendResult.error.message;
      }
    } catch (err: any) {
      visitorWarning = err?.message || 'Visitor delivery failed.';
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your message has been sent successfully. A confirmation email has been sent to your inbox.',
      visitorWarning: visitorWarning || undefined,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'An unexpected error occurred while processing your request.',
    });
  }
}
