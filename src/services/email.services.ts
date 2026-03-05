import { html5Email } from "zod/v4/core/regexes.cjs";
import { env } from "../config/env";
// import { Resend } from "resend";
// import type { CreateEmailResponse } from "resend";
// const resend = new Resend(env.RESEND_EMAIL_API_KEY);
import nodemailer from "nodemailer";
import { success } from "zod";
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// export const sendEmail = async ({
//   to,
//   subject,
//   html,
// }: EmailOptions): Promise<CreateEmailResponse> => {
//   try {
//     const response = await resend.emails.send({
//       from: env.EMAIL_FROM,
//       to,
//       subject,
//       html,
//     });
//     return response;
//   } catch (error: any) {
//     console.error("Email sending failed:", error);
//     throw new Error("Email sending failed");
//   }
// };

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
});

export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  try {
    await transporter.sendMail({
      from: env.GMAIL_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Email sending failed");
  }
};

const EMAIL_STYLES = {
  container: `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
    background-color: #667eea;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  `,
  card: `
    background: white;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  `,
  logo: `
    font-size: 28px;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 24px;
    text-align: center;
  `,
  heading: `
    color: #2d3748;
    font-size: 24px;
    margin-bottom: 16px;
    font-weight: 600;
  `,
  text: `
    color: #4a5568;
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 16px;
  `,
  otpBox: `
    background-color: #667eea !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff !important;
    font-size: 36px;
    font-weight: bold;
    letter-spacing: 8px;
    padding: 24px;
    border-radius: 12px;
    text-align: center;
    margin: 32px 0;
    font-family: 'Courier New', monospace;
  `,
  footer: `
    margin-top: 32px;
    padding-top: 24px;
    border-top: 2px solid #e2e8f0;
    color: #718096;
    font-size: 14px;
    text-align: center;
  `,
  warning: `
    background: #fff5f5;
    border-left: 4px solid #fc8181;
    padding: 16px;
    margin: 24px 0;
    border-radius: 8px;
    color: #742a2a;
    font-size: 14px;
  `,
  button: `
    display: inline-block;
    background-color: #667eea !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff !important;
    padding: 16px 40px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
  `,
};

//*EMAIL TEMPLATES GENERATED USING CLAUDE
// OTP Email Template
export const generateOtpEmail = (otp: string) => {
  const subject = "Your WebMusicVault Verification Code";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f7fafc;">
        <div style="${EMAIL_STYLES.container}">
          <div style="${EMAIL_STYLES.card}">
            <div style="${EMAIL_STYLES.logo}">
              🎵 WebMusicVault
            </div>
            
            <h1 style="${EMAIL_STYLES.heading}">
              Verify Your Account
            </h1>
            
            <p style="${EMAIL_STYLES.text}">
              Hello there! 👋
            </p>
            
            <p style="${EMAIL_STYLES.text}">
              We received a request to verify your email address. Use the code below to complete your verification:
            </p>
            
            <div style="${EMAIL_STYLES.otpBox}">
              ${otp}
            </div>
            
            <p style="${EMAIL_STYLES.text}">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            
            <div style="${EMAIL_STYLES.warning}">
              ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. WebMusicVault will never ask for your verification code.
            </div>
            
            <div style="${EMAIL_STYLES.footer}">
              <p style="margin: 0 0 8px 0;">
                Didn't request this code?
              </p>
              <p style="margin: 0; color: #a0aec0;">
                You can safely ignore this email. Your account remains secure.
              </p>
              <p style="margin: 24px 0 0 0; color: #cbd5e0; font-size: 12px;">
                © ${new Date().getFullYear()} WebMusicVault. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
};

// Welcome Email Template
export const generateWelcomeEmail = (username: string) => {
  const subject = "Welcome to WebMusicVault! 🎉";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f7fafc;">
        <div style="${EMAIL_STYLES.container}">
          <div style="${EMAIL_STYLES.card}">
            <div style="${EMAIL_STYLES.logo}">
              🎵 WebMusicVault
            </div>
            
            <h1 style="${EMAIL_STYLES.heading}">
              Welcome Aboard, ${username}! 🎉
            </h1>
            
            <p style="${EMAIL_STYLES.text}">
              We're thrilled to have you join the WebMusicVault community!
            </p>
            
            <p style="${EMAIL_STYLES.text}">
              Your account is now active and ready to go. Here's what you can do:
            </p>
            
            <ul style="color: #4a5568; font-size: 16px; line-height: 1.8;">
              <li>Upload and organize your music collection</li>
              <li>Create custom playlists</li>
              <li>Discover new music</li>
              <li>Share your favorite tracks</li>
            </ul>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${env.FRONTEND_URL}" style="${EMAIL_STYLES.button}">
                Get Started
              </a>
            </div>
            
            <div style="${EMAIL_STYLES.footer}">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                © ${new Date().getFullYear()} WebMusicVault. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
};

// Password Reset Email Template
export const generatePasswordResetEmail = (resetLink: string) => {
  const subject = "Reset Your WebMusicVault Password";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f7fafc;">
        <div style="${EMAIL_STYLES.container}">
          <div style="${EMAIL_STYLES.card}">
            <div style="${EMAIL_STYLES.logo}">
              🎵 WebMusicVault
            </div>
            
            <h1 style="${EMAIL_STYLES.heading}">
              Password Reset Request
            </h1>
            
            <p style="${EMAIL_STYLES.text}">
              We received a request to reset your password. Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="${EMAIL_STYLES.button}">
                Reset Password
              </a>
            </div>
            
            <p style="${EMAIL_STYLES.text}">
              This link will expire in <strong>1 hour</strong>.
            </p>
            
            <div style="${EMAIL_STYLES.warning}">
              ⚠️ <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </div>
            
            <div style="${EMAIL_STYLES.footer}">
              <p style="margin: 0 0 8px 0; color: #a0aec0; font-size: 14px;">
                Or copy and paste this link:
              </p>
              <p style="margin: 0; color: #cbd5e0; font-size: 12px; word-break: break-all;">
                ${resetLink}
              </p>
              <p style="margin: 24px 0 0 0; color: #cbd5e0; font-size: 12px;">
                © ${new Date().getFullYear()} WebMusicVault. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
};
