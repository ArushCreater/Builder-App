// Branded email sending via Resend.
// Env vars:
//   RESEND_API_KEY  — Resend API key (required)
//   EMAIL_FROM      — "Baaz Homes <noreply@yourdomain.com>" or onboarding@resend.dev for testing
//   APP_BASE_URL    — frontend URL used to build links inside emails (e.g. https://builder-app.vercel.app)

const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Baaz Homes <onboarding@resend.dev>';
const APP_BASE_URL = process.env.APP_BASE_URL || '';

const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return String(d); }
}

// ── Shared brand chrome ──────────────────────────────────────────────────────
function shell({ preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BuilderOS</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
      <!-- Header -->
      <tr><td style="background:#0f172a;padding:24px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;padding-right:12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
              <div style="background:linear-gradient(135deg,#818cf8,#67e8f9);width:22px;height:22px;border-radius:8px;color:#0f172a;font-weight:800;font-size:13px;line-height:22px;margin:0 auto;">B</div>
            </td></tr></table>
          </td>
          <td style="vertical-align:middle;color:#fff;">
            <div style="font-size:18px;font-weight:800;letter-spacing:-0.01em;line-height:1;">BuilderOS</div>
            <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-top:4px;">powered by Baaz Homes</div>
          </td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 40px;">${bodyHtml}</td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        <span style="font-weight:600;color:#64748b;">BuilderOS</span> · powered by Baaz Homes
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ── Template: Doc approval request ───────────────────────────────────────────
function docApprovalEmail({ projectName, docTitle, shareUrl }) {
  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Approval Requested</p>
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;">Baaz Homes is requesting your approval</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
      Please review the document below${projectName ? ` for <strong style="color:#0f172a;">${escapeHtml(projectName)}</strong>` : ''} and click the button to confirm your approval.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;width:100%;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px;">Document</div>
        <div style="font-size:18px;color:#0f172a;font-weight:700;">${escapeHtml(docTitle || 'Untitled')}</div>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td>
      <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
        Review &amp; Approve →
      </a>
    </td></tr></table>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">Or copy this link into your browser:<br><span style="color:#6366f1;word-break:break-all;">${escapeHtml(shareUrl)}</span></p>
  `;
  return shell({ preheader: `Baaz Homes is requesting approval for ${docTitle}`, bodyHtml: body });
}

// ── Template: Schedule reminder with mini gantt row ──────────────────────────
function ganttSnapshotHtml({ title, startDate, endDate }) {
  // Build a 7-day strip centered on the start date with the task duration highlighted.
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  if (isNaN(start.getTime())) return '';

  const days = [];
  const base = new Date(start);
  base.setDate(base.getDate() - 2); // show 2 days before
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const inRange = d >= new Date(start.toDateString()) && d <= new Date(end.toDateString());
    days.push({ d, inRange });
  }

  const cells = days.map(({ d, inRange }) => {
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `<td style="width:14.28%;text-align:center;padding:0 2px;vertical-align:top;">
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${dow}</div>
      <div style="font-size:11px;color:#475569;margin-top:2px;font-weight:600;">${label}</div>
      <div style="height:32px;margin-top:8px;background:${inRange ? 'linear-gradient(135deg,#6366f1,#818cf8)' : '#f1f5f9'};border-radius:6px;${inRange ? 'box-shadow:0 2px 6px rgba(99,102,241,0.3);' : ''}"></div>
    </td>`;
  }).join('');

  return `
    <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:0 0 24px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px;">Schedule snapshot</div>
      <div style="font-size:14px;color:#0f172a;font-weight:700;margin-bottom:12px;">${escapeHtml(title)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed;"><tr>${cells}</tr></table>
    </div>
  `;
}

function scheduleReminderEmail({ title, startDate, endDate, projectName, assignee, description, location }) {
  const gantt = ganttSnapshotHtml({ title, startDate, endDate });
  const details = [
    projectName && { label: 'Project', value: projectName },
    formatDate(startDate) && { label: 'Starts', value: formatDate(startDate) },
    endDate && endDate !== startDate && formatDate(endDate) && { label: 'Ends', value: formatDate(endDate) },
    assignee && { label: 'Assignee', value: assignee },
    location && { label: 'Location', value: location },
  ].filter(Boolean);

  const detailsRows = details.map(d => `
    <tr><td style="padding:6px 0;font-size:13px;color:#94a3b8;width:35%;vertical-align:top;">${escapeHtml(d.label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;vertical-align:top;">${escapeHtml(d.value)}</td></tr>
  `).join('');

  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#f59e0b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">⏰ Reminder · in 24 hours</p>
    <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
      This is your reminder that the event below is scheduled to start in approximately 24 hours.
    </p>
    ${gantt}
    ${details.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px 18px;margin:0 0 20px;"><tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detailsRows}</table></td></tr></table>` : ''}
    ${description ? `<div style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Description</div><p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escapeHtml(description)}</p>` : ''}
  `;
  return shell({ preheader: `Reminder: ${title} starts in 24 hours`, bodyHtml: body });
}

// ── Public API ───────────────────────────────────────────────────────────────
async function sendDocApprovalRequest({ emails, projectName, docTitle, shareToken }) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');
  if (!APP_BASE_URL) console.warn('APP_BASE_URL is not set — share link in email may be incomplete');
  const shareUrl = `${APP_BASE_URL.replace(/\/$/, '')}/shared/${shareToken}`;
  const html = docApprovalEmail({ projectName, docTitle, shareUrl });
  const subject = `${projectName ? projectName + ': ' : ''}Approval requested — ${docTitle || 'Document'}`;
  const results = [];
  for (const to of emails) {
    try {
      const r = await resend.emails.send({ from: FROM, to, subject, html });
      results.push({ to, ok: true, id: r?.data?.id || null });
    } catch (err) {
      console.error('Resend failed for', to, err?.message || err);
      results.push({ to, ok: false, error: err?.message || String(err) });
    }
  }
  return results;
}

async function sendScheduleReminder({ to, title, startDate, endDate, projectName, assignee, description, location }) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');
  const html = scheduleReminderEmail({ title, startDate, endDate, projectName, assignee, description, location });
  const subject = `Reminder: ${title} — starts ${formatDate(startDate)}`;
  return resend.emails.send({ from: FROM, to, subject, html });
}

function isConfigured() { return !!resend; }

module.exports = { sendDocApprovalRequest, sendScheduleReminder, isConfigured };
