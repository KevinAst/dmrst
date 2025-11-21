import nodemailer from 'nodemailer';

import logger from '../core/util/logger/logger.js';
const  logPrefix = 'vit:server:util/mailer';
const  log = logger(`${logPrefix}`);

// retain our mail transporter, with our authorization credentials
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port:   587,   // TLS port
  secure: false, // use TLS on port 587
  auth: {        // glean these credentials from our environment settings
    user: process.env.EMAIL_API_USER,
    pass: process.env.EMAIL_API_PASS,
  }
});

// send an email on behalf of replyno@vzual.org (e.g. FROM)
// USAGE:
//   import {sendEmail} from './mailer.js';
//   
//   sendEmail({
//     to: "test@example.com",
//     subject: "Hello from Node + Brevo",
//     text: "Plain text version here",
//     html: "<p>This is an <strong>HTML email</strong>.</p>"
//   });
export async function sendEmail({to, cc, bcc, subject, html, text}) {
  const log = logger(`${logPrefix}:sendEmail`);

  const info = await transporter.sendMail({
    from: '"Vzual No-Reply" <replyno@vzual.org>',
    to,
    cc,
    bcc,
    subject,
    text, // KJB: PRESUMABLY text/html are mutually exclusive
    html
  });

  log(`Message sent - messageId: ${info.messageId} ... `, {to, subject, info});
  return info;
}

