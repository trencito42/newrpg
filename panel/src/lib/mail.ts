import nodemailer, { type Transporter } from "nodemailer";
import path from "path";
import fs from "fs";

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "mail.xodo.ro",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false", // true for 465
  auth: {
    user: process.env.SMTP_USER || "support@racket.cat",
    pass: process.env.SMTP_PASS || "cOpheA,_,66",
  },
  from: process.env.SMTP_FROM || '"Racket RPG Support" <support@racket.cat>',
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      auth: SMTP_CONFIG.auth,
      connectionTimeout: 10000,
    });
  }
  return transporter;
}

export interface SendPasswordResetOptions {
  to: string;
  username: string;
  resetUrl: string;
  ipAddress?: string | null;
}

/**
 * Sends a clean, simplified, Arial-based password reset email for Racket RPG.
 */
export async function sendPasswordResetEmail({
  to,
  username,
  resetUrl,
}: SendPasswordResetOptions): Promise<boolean> {
  const mailer = getTransporter();

  const brandName = "Racket RPG";
  const webLogoUrl = "https://rpg.racket.cat/logo-email.png";

  const logoPath = path.join(process.cwd(), "public", "logo-email.png");
  const hasLocalLogo = fs.existsSync(logoPath);
  const logoSrc = hasLocalLogo ? "cid:racketlogo" : webLogoUrl;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resetare Parolă — ${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0d0f; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0d0d0f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #141417; border-radius: 8px; overflow: hidden; padding: 32px 28px;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <a href="https://racket.cat" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoSrc}" alt="${brandName}" width="160" style="display: block; width: 160px; max-width: 160px; height: auto; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- Greeting & Main Message -->
          <tr>
            <td style="color: #ffffff; font-size: 15px; line-height: 1.5; padding-bottom: 24px;">
              <div style="font-size: 17px; font-weight: bold; color: #ffffff; margin-bottom: 12px;">
                Salut, <span style="color: #d7b558;">${username}</span>,
              </div>
              <div style="color: #cccccc; font-size: 14px; line-height: 1.6;">
                Ai solicitat resetarea parolei pentru contul tău de pe <strong style="color: #ffffff;">${brandName}</strong>. Pentru a alege o parolă nouă, apasă pe butonul de mai jos:
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #d7b558;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: bold; color: #000000 !important; text-decoration: none; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px;">
                      Resetează Parola
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security note & expiration -->
          <tr>
            <td style="color: #888888; font-size: 12px; line-height: 1.6; padding-bottom: 24px; border-top: 1px solid #222226; padding-top: 20px;">
              <div style="margin-bottom: 6px;">
                • Linkul este valabil timp de <strong style="color: #dddddd;">30 de minute</strong>.
              </div>
              <div>
                • Dacă nu ai cerut această resetare, ignoră acest email. Parola ta actuală rămâne neschimbată.
              </div>
            </td>
          </tr>

          <!-- Fallback Link -->
          <tr>
            <td style="font-size: 11px; color: #666666; line-height: 1.5; word-break: break-all; padding-bottom: 16px;">
              Dacă butonul nu funcționează, copiază acest link în browser:<br />
              <a href="${resetUrl}" style="color: #d7b558; text-decoration: underline;">${resetUrl}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 20px; border-top: 1px solid #222226; font-size: 11px; color: #666666; line-height: 1.5;">
              <strong style="color: #aaaaaa;">RACKET RPG</strong> &bull; <a href="https://racket.cat" style="color: #d7b558; text-decoration: none;">racket.cat</a><br />
              Acest mesaj a fost expediat automat de sistemul de autentificare Racket.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
Salut ${username},

Ai solicitat resetarea parolei pentru contul tău ${brandName}.
Pentru a seta o parolă nouă, deschide linkul de mai jos în browser (valabil 30 de minute):

${resetUrl}

Dacă nu ai cerut această resetare, ignoră acest mesaj. Parola ta rămâne neschimbată.

— Echipa ${brandName} (racket.cat)
  `.trim();

  const attachments = hasLocalLogo
    ? [
        {
          filename: "logo.png",
          path: logoPath,
          cid: "racketlogo",
        },
      ]
    : [];

  try {
    await mailer.sendMail({
      from: SMTP_CONFIG.from,
      to,
      subject: `[${brandName}] Resetare Parolă Cont — ${username}`,
      text: textContent,
      html: htmlContent,
      attachments,
    });
    return true;
  } catch (error) {
    console.error("[mail] Error sending password reset email:", error);
    return false;
  }
}
