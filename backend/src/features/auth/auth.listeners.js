import authEvents from './auth.events.js';
import IntegrationHub from '../integrationHub/integrationHub.model.js';
import { decryptCredential } from '../integrationHub/utils/crypto.util.js';
import logger from '../../utils/logger.utils.js';
import { maskPhone, maskEmail } from '../../utils/phone.utils.js';
import nodemailer from 'nodemailer';

authEvents.on('OTP_SENT', async ({ identifier, code, type }) => {
  if (type === 'EMAIL') {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[AUTH OTP DELIVERED] Identifier: ${maskEmail(identifier)} | Verification OTP Code: ${code}`);
    } else {
      logger.info(`[AUTH OTP DISPATCHED] Identifier: ${maskEmail(identifier)}`);
    }

    try {
      // 1. Check IntegrationHub SMTP integrations (prefer latest updated connected SMTP)
      const smtpIntegrations = await IntegrationHub.find({ provider: 'smtp', status: 'connected' })
        .sort({ updatedAt: -1, createdAt: -1 });

      for (const smtpIntegration of smtpIntegrations) {
        try {
          const getCred = (key) => {
            const cred = smtpIntegration.credentials.find((c) => c.key === key);
            return cred ? decryptCredential(cred) : null;
          };

          const host = getCred('host');
          const port = getCred('port');
          const authUsername = getCred('authUsername');
          const authPassword = getCred('authPassword');

          if (host && port && authUsername && authPassword) {
            const transporter = nodemailer.createTransport({
              host,
              port: parseInt(port, 10),
              secure: parseInt(port, 10) === 465,
              auth: {
                user: authUsername,
                pass: authPassword,
              },
            });

            await transporter.sendMail({
              from: `"${smtpIntegration.accountLabel || 'Nahom'}" <${authUsername}>`,
              to: identifier,
              subject: 'Your One-Time Password (OTP)',
              html: `<h3>Your Verification Code</h3><p>Your code is: <strong>${code}</strong></p><p>This code will expire in 15 minutes.</p>`,
            });

            logger.info(`OTP email sent successfully to ${maskEmail(identifier)} via IntegrationHub SMTP (${host} - ${authUsername})`);
            return;
          }
        } catch (smtpErr) {
          logger.warn(`Failed sending email via IntegrationHub SMTP (${smtpIntegration._id}): ${smtpErr.message}. Trying next provider...`);
        }
      }

      // 2. Check Resend API integration
      const resendIntegration = await IntegrationHub.findOne({ provider: 'resend', status: 'connected' });
      
      if (resendIntegration) {
        const apiKeyCred = resendIntegration.credentials.find((c) => c.key === 'apiKey');
        if (apiKeyCred) {
          const apiKey = decryptCredential(apiKeyCred);
          
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: 'ManageMyGate <onboarding@resend.dev>',
              to: [identifier],
              subject: 'Your One-Time Password (OTP)',
              html: `<h3>Your Verification Code</h3><p>Your code is: <strong>${code}</strong></p><p>This code will expire in 15 minutes.</p>`,
            }),
          });

          if (response.ok) {
            logger.info(`OTP email sent to ${maskEmail(identifier)} via Resend`);
            return;
          } else {
            const errData = await response.json();
            logger.error(`Resend email failed: ${errData.message}`);
          }
        }
      }

      // 3. Fallback to global environment SMTP via email.utils.js
      const { getSmtpTransporter } = await import('../../utils/email.utils.js');
      const smtpObj = await getSmtpTransporter();
      if (smtpObj) {
        const { transporter, from } = smtpObj;
        await transporter.sendMail({
          from,
          to: identifier,
          subject: 'Your One-Time Password (OTP)',
          html: `<h3>Your Verification Code</h3><p>Your code is: <strong>${code}</strong></p><p>This code will expire in 15 minutes.</p>`,
        });
        logger.info(`OTP email sent to ${maskEmail(identifier)} via Environment SMTP`);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`No active SMTP/Resend provider configured. Email not sent. [DEV OTP CODE: ${code}]`);
      } else {
        logger.warn(`No active SMTP/Resend provider configured. Email not sent to ${maskEmail(identifier)}`);
      }
    } catch (error) {
      logger.error(`Failed to send OTP email to ${maskEmail(identifier)}: ${error.message}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`[FALLBACK DEV OTP] Code for ${maskEmail(identifier)}: ${code}`);
      }
    }
  } else if (type === 'SMS') {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[AUTH OTP DELIVERED - SMS] Phone: ${maskPhone(identifier)} | Verification OTP Code: ${code}`);
    } else {
      logger.info(`[AUTH OTP DISPATCHED - SMS] Phone: ${maskPhone(identifier)}`);
    }
    try {
      // 1. Check Twilio
      const twilioIntegration = await IntegrationHub.findOne({ provider: 'twilio', status: 'connected' });
      if (twilioIntegration) {
        const getCred = (key) => {
          const cred = twilioIntegration.credentials.find((c) => c.key === key);
          return cred ? decryptCredential(cred) : null;
        };
        const accountSid = getCred('accountSid');
        const authToken = getCred('authToken');
        const fromNumber = getCred('fromNumber');

        if (accountSid && authToken && fromNumber) {
          const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
          const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: identifier,
              From: fromNumber,
              Body: `Your verification code is: ${code}. It will expire in 5 minutes.`,
            }),
          });
          if (response.ok) {
            logger.info(`OTP SMS sent to ${maskPhone(identifier)} via Twilio`);
            return;
          } else {
            const errData = await response.json();
            logger.error(`Twilio SMS failed: ${errData.message}`);
          }
        }
      }

      // 2. Fallback to Message Central
      const mcIntegration = await IntegrationHub.findOne({ provider: 'messagecentral', status: 'connected' });
      if (mcIntegration) {
        const getCred = (key) => {
          const cred = mcIntegration.credentials.find((c) => c.key === key);
          return cred ? decryptCredential(cred) : null;
        };
        const customerId = getCred('customerId')?.trim();
        const authToken = getCred('authToken')?.trim();
        const countryCode = getCred('countryCode')?.trim();
        
        if (customerId && authToken) {
          let jwt = null;

          // Check if the user provided an already-generated long-lived JWT instead of a password
          if (authToken.split('.').length === 3) {
            try {
              const payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString('utf8'));
              if (payload.sub && payload.exp) {
                jwt = authToken;
              }
            } catch (e) {
              // Not a valid JWT, fall through to token generation
            }
          }

          if (!jwt) {
            // Attempt 1: Assume the user provided a raw password, so we base64 encode it.
            const base64Key = Buffer.from(authToken).toString('base64');
            let tokenUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${encodeURIComponent(customerId)}&key=${encodeURIComponent(base64Key)}&scope=NEW&country=${encodeURIComponent(countryCode)}`;
            
            let tokenRes = await fetch(tokenUrl, { method: 'GET' });
            let tokenData;
            try { tokenData = await tokenRes.json(); } catch {}

            // If Attempt 1 failed with "password is wrong" (status 400), try Attempt 2:
            // Assume the user provided an ALREADY base64-encoded password.
            if ((tokenData && tokenData.error === 'password is wrong') || (tokenData && tokenData.status === 400)) {
              tokenUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${encodeURIComponent(customerId)}&key=${encodeURIComponent(authToken)}&scope=NEW&country=${encodeURIComponent(countryCode)}`;
              tokenRes = await fetch(tokenUrl, { method: 'GET' });
              try { tokenData = await tokenRes.json(); } catch {}
            }
            
            if (tokenRes.ok) {
              if (tokenData && (tokenData.error || !tokenData.token)) {
                logger.error(`Message Central token fetch failed: ${tokenData.error || 'No token returned'}`);
                return;
              }
              jwt = tokenData.token;
            } else {
              logger.error(`Message Central token fetch failed: HTTP ${tokenRes.status}`);
              return;
            }
          }

          if (jwt) {
            // Attempt to send via VerifyNow which might allow custom OTP by appending to URL or generic SMS API
            const e164Digits = identifier.replace(/^\+/, '');
            const normalizedCountryCode = String(countryCode || '').replace(/\D/g, '');
            const mobileNumber = normalizedCountryCode && e164Digits.startsWith(normalizedCountryCode)
              ? e164Digits.slice(normalizedCountryCode.length)
              : e164Digits;
            const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=${countryCode}&customerId=${customerId}&flowType=SMS&mobileNumber=${mobileNumber}&otp=${code}`;
            const sendRes = await fetch(sendUrl, {
              method: 'POST',
              headers: {
                'authToken': jwt,
              }
            });
            
            if (sendRes.ok) {
              logger.info(`OTP SMS sent to ${maskPhone(identifier)} via Message Central`);
              return;
            } else {
              const errData = await sendRes.json().catch(() => ({ message: sendRes.statusText }));
              logger.error(`Message Central SMS failed: ${errData.message}`);
            }
          }
        }
      }

      logger.warn(`No active SMS provider (Twilio/MessageCentral) found. OTP SMS to ${maskPhone(identifier)} was not sent. Check your integrations.`);
    } catch (error) {
      logger.error(`Failed to send OTP SMS to ${maskPhone(identifier)}: ${error.message}`);
    }
  }
});
