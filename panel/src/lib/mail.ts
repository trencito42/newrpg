import nodemailer, { type Transporter } from "nodemailer";

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
 * Sends a high-security, branded password reset email.
 */
export async function sendPasswordResetEmail({
  to,
  username,
  resetUrl,
  ipAddress,
}: SendPasswordResetOptions): Promise<boolean> {
  const mailer = getTransporter();

  const brandName = "RACKET RPG";
  const brandDomain = "racket.cat";

  const htmlContent = `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resetare Parolă Cont — ${brandName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #07090e;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #07090e;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background: #111625;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header-bar {
      height: 4px;
      background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
    }
    .header {
      padding: 32px 36px 20px;
      text-align: center;
      background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
    }
    .logo-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 6px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
    }
    .content {
      padding: 24px 36px 36px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 16px;
      color: #f8fafc;
      margin-bottom: 16px;
    }
    .greeting strong {
      color: #818cf8;
    }
    .text {
      font-size: 14px;
      color: #cbd5e1;
      margin: 0 0 24px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      letter-spacing: 0.2px;
    }
    .info-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 12px;
      color: #94a3b8;
    }
    .info-card strong {
      color: #e2e8f0;
    }
    .fallback-url {
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      margin-top: 16px;
    }
    .fallback-url a {
      color: #818cf8;
      text-decoration: none;
    }
    .footer {
      padding: 24px 36px;
      background: #0d111d;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer-brand {
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header-bar"></div>
      <div class="header">
        <div class="logo-badge">Security Service</div>
        <h1 class="title">${brandName}</h1>
        <p class="subtitle">Cerere de resetare a parolei de autentificare</p>
      </div>
      <div class="content">
        <div class="greeting">Salut, <strong>${username}</strong>,</div>
        <p class="text">
          Am primit o solicitare de resetare a parolei pentru contul tău de pe serverul <strong>${brandName}</strong>.
          Apasă pe butonul de mai jos pentru a alege o nouă parolă securizată:
        </p>

        <div class="btn-container">
          <a href="${resetUrl}" class="btn" target="_blank">Resetează Parola Contului</a>
        </div>

        <div class="info-card">
          ⏱️ <strong>Valabilitate:</strong> Acest link expiră în <strong>30 de minute</strong>.<br>
          ${ipAddress ? `🌐 <strong>IP Solicitant:</strong> ${ipAddress}<br>` : ""}
          🔒 Dacă nu ai inițiat tu această solicitare, poți ignora acest mesaj în siguranță — parola ta rămâne neschimbată.
        </div>

        <div class="fallback-url">
          Dacă butonul nu funcționează, copiază și deschide linkul în browser:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">${brandName} &bull; ${brandDomain}</div>
        <div>Acesta este un email automat de securitate trimis de la serverul oficial.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Salut ${username},

Am primit o solicitare de resetare a parolei pentru contul tău ${brandName}.
Pentru a-ți reseta parola, accesează următorul link în browser (valabil 30 de minute):

${resetUrl}

Dacă nu ai cerut tu această resetare, ignoră acest email.

— Echipa ${brandName} (${brandDomain})
  `.trim();

  try {
    await mailer.sendMail({
      from: SMTP_CONFIG.from,
      to,
      subject: `[${brandName}] Resetare Parolă Cont — ${username}`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error("[mail] Error sending password reset email:", error);
    return false;
  }
}
