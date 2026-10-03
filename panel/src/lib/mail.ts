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
 * Sends a high-security, branded password reset email matching the Racket Panel design.
 */
export async function sendPasswordResetEmail({
  to,
  username,
  resetUrl,
  ipAddress,
}: SendPasswordResetOptions): Promise<boolean> {
  const mailer = getTransporter();

  const brandName = "RACKET RPG";
  const webLogoUrl = "https://rpg.blipmade.com/logo-email.png";

  // Check if local logo exists for CID inline attachment
  const logoPath = path.join(process.cwd(), "public", "logo-email.png");
  const hasLocalLogo = fs.existsSync(logoPath);

  const logoSrc = hasLocalLogo ? "cid:racketlogo" : webLogoUrl;

  const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ro">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resetare Parolă Cont — ${brandName}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #08080a; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#08080a; font-family:'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#08080a; padding:40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px; background-color:#101012; border:1px solid #232220; border-radius:14px; overflow:hidden; box-shadow:0 24px 48px rgba(0,0,0,0.85);">
          
          <!-- Top Accent Gold Line -->
          <tr>
            <td style="height:3px; background:linear-gradient(90deg, #d7b558 0%, #e2bc61 50%, #f6f2eb 100%); line-height:3px; font-size:1px;">&nbsp;</td>
          </tr>

          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding:36px 32px 24px; background-color:#0e0e10; border-bottom:1px solid #1a191b;">
              <a href="https://rpg.blipmade.com" target="_blank" style="text-decoration:none; display:inline-block;">
                <img src="${logoSrc}" alt="${brandName}" width="180" height="40" style="display:block; width:180px; max-width:180px; height:auto; margin:0 auto 16px; border:0;" />
              </a>
              <div style="display:inline-block; padding:4px 12px; background-color:rgba(215, 181, 88, 0.12); border:1px solid rgba(215, 181, 88, 0.28); border-radius:6px; color:#d7b558; font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
                Securitate Cont
              </div>
              <div style="margin-top:10px; font-size:12px; font-weight:600; color:#a9a59c; letter-spacing:0.05em; text-transform:uppercase;">
                Cerere Resetare Parolă
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px 32px 28px; background-color:#101012; color:#f2efe8; font-size:14px; line-height:1.6;">
              <div style="font-size:16px; font-weight:700; color:#f2efe8; margin-bottom:12px;">
                Salut, <span style="color:#d7b558;">${username}</span>
              </div>
              
              <p style="margin:0 0 20px; font-size:13px; color:#b4afa4; line-height:1.65;">
                A fost inițiată o cerere de resetare a parolei pentru contul tău de pe platforma 
                <strong style="color:#f2efe8;">${brandName}</strong>. 
                Pentru a configura o parolă nouă securizată, apasă pe butonul de mai jos:
              </p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius:10px; background-color:#d7b558;">
                          <a href="${resetUrl}" target="_blank" style="display:inline-block; padding:13px 36px; font-family:'Montserrat', sans-serif; font-size:12px; font-weight:900; color:#08080a !important; text-decoration:none; text-transform:uppercase; letter-spacing:0.08em; border-radius:10px;">
                            Resetează Parola
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Info Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0; background-color:#131315; border:1px solid rgba(242, 239, 232, 0.07); border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px; font-size:12px; color:#a9a59c; line-height:1.6;">
                    <div style="margin-bottom:6px;"><strong style="color:#d7b558;">⏱️ Expirare:</strong> Linkul este valabil timp de <strong style="color:#f2efe8;">30 de minute</strong>.</div>
                    ${ipAddress ? `<div style="margin-bottom:6px;"><strong style="color:#d7b558;">🌐 IP Solicitant:</strong> <span style="color:#f2efe8; font-family:monospace;">${ipAddress}</span></div>` : ""}
                    <div><strong style="color:#d7b558;">🔒 Notă de securitate:</strong> Dacă nu ai solicitat tu această resetare, poți ignora acest email în siguranță. Parola ta actuală rămâne neschimbată.</div>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <div style="font-size:11px; color:#78746c; margin-top:20px; line-height:1.5; word-break:break-all;">
                Dacă butonul nu funcționează, copiază și deschide linkul de mai jos în browser:<br />
                <a href="${resetUrl}" style="color:#d7b558; text-decoration:underline;">${resetUrl}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 32px; background-color:#08080a; border-top:1px solid #1a191b; font-size:11px; color:#68645e; line-height:1.6;">
              <strong style="color:#8f8b83; text-transform:uppercase; letter-spacing:0.05em;">${brandName} &bull; Panel &amp; RPG Server</strong><br />
              <a href="https://rpg.blipmade.com" style="color:#d7b558; text-decoration:none;">rpg.blipmade.com</a><br />
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

A fost înregistrată o solicitare de resetare a parolei pentru contul tău ${brandName}.
Pentru a alege o nouă parolă, deschide linkul de mai jos în browser (valabil 30 de minute):

${resetUrl}

Dacă nu ai cerut tu această resetare, ignoră acest email. Parola ta rămâne neschimbată.

— Echipa ${brandName} (rpg.blipmade.com)
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
