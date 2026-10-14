import type { IncomingMessage, ServerResponse } from 'node:http';

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

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const envEmail = process.env.CONTACT_TO_EMAIL;
  const recipientEmail = (!envEmail || envEmail.includes('example.com'))
    ? 'thecodergirly@gmail.com'
    : envEmail.trim();

  const apiKey = process.env.RESEND_API_KEY;
  const isResendConfigured = Boolean(
    apiKey &&
    apiKey.trim() !== '' &&
    !apiKey.includes('re_placeholder') &&
    !apiKey.includes('your-resend-api-key')
  );

  return res.status(200).json({
    status: 'ok',
    service: 'portfolio-contact-api',
    provider: 'resend',
    recipientEmail,
    resendConfigured: isResendConfigured,
  });
}
