import { fmtDate, fmtTime, placeOf, tzLabel, fmtShort, regHref } from './eventStore.js'
import { ROLES } from './logoLib.js'

// ---- Invitation generator: one default email built from the event, with a plain-text alternative. ----
// Email-compatible: table layout, inline CSS, no scripts, essential details as text (never only inside an image).
// Logos come from the shared logo library; SVG logos are rasterised first because many mail clients do not show SVG.
export const CONTACT = { name: 'Blue Science Park', email: 'events@bluesciencepark.example', web: 'https://www.bluesciencepark.se/kontakt/' }
export const TOKENS = { preferences: '{{preferences_url}}', unsubscribe: '{{unsubscribe_url}}' }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2b3cff')
const ink = hex => { const n = parseInt(hex.slice(1), 16); const l = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; return l > 0.62 ? '#0f1222' : '#ffffff' }

export function defaultIntro(ev) {
  const when = ev.date ? ` on ${fmtShort(ev.date)}` : ''
  return `You are invited to ${ev.title.trim() || 'our event'}${when}.`
}
export const subjectOf = ev => (ev.title.trim() ? `Invitation: ${ev.title.trim()}` : 'Invitation')

// Contained size for a logo inside an email slot. Keeps the aspect ratio; both attributes are set so clients cannot stretch it.
function slot(org, maxH, maxW) {
  const l = org.logo
  const ar = l ? l.w / l.h || 1 : 3
  let w = maxH * ar, h = maxH
  if (w > maxW) { w = maxW; h = w / ar }
  const k = (l?.scale || 100) / 100
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

function logoCell(org, role, primary, src) {
  const maxH = primary ? 54 : 40
  if (!org.logo || !src) return `<td align="center" style="padding:6px 10px;font:600 14px Arial,Helvetica,sans-serif;color:#0f1222">${esc(org.name)}${role ? `<br><span style="font:11px Arial,sans-serif;color:#6b7194">${esc(ROLES[role])}</span>` : ''}</td>`
  const { w, h } = slot(org, maxH, 180)
  const bg = org.logo.bg === 'dark' ? '#0f1222' : '#ffffff'
  return `<td align="center" style="padding:6px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="${bg}" style="background:${bg};border:1px solid #e3e6f4;border-radius:8px;padding:8px 12px"><img src="${esc(src)}" alt="${esc(org.name)}" width="${w}" height="${h}" style="display:block;width:${w}px;height:${h}px;border:0"></td></tr></table>${role ? `<div style="font:11px Arial,sans-serif;color:#6b7194;margin-top:4px;text-align:center">${esc(ROLES[role])}</div>` : ''}</td>`
}

// orgs: id -> org. logoSrc: id -> raster URL/data-URL (resolved by the caller; hosted URLs when sending for real).
export function buildInvitation(ev, orgs, logoSrc = {}) {
  const inv = ev.invite, accent = safeColor(inv.accent), onAccent = ink(accent)
  const organiser = ev.organiser ? orgs[ev.organiser] : null
  const sponsors = ev.sponsors.map(s => ({ ...s, org: orgs[s.orgId] })).filter(s => s.org)
  const intro = (inv.intro || '').trim() || defaultIntro(ev)
  const place = placeOf(ev)
  const rows = [
    ['Date', fmtDate(ev.date)],
    ['Time', ev.start ? `${fmtTime(ev)} (${tzLabel(ev.tz)})` : ''],
    [ev.mode === 'online' ? 'Where' : 'Location', place],
    ev.mode !== 'in-person' && ev.link ? ['Join online', ev.link] : null,
    ev.regDeadline ? ['Register by', fmtDate(ev.regDeadline)] : null,
  ].filter(r => r && r[1])
  const cta = esc(inv.buttonLabel || 'Register now')
  const layout = inv.layout
  const showCover = inv.cover && ev.cover
  const sp = sponsors.length
    ? `<tr><td style="padding:18px 24px 6px;text-align:center"><div style="font:600 11px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b7194;margin-bottom:6px">${sponsors.every(s => s.role === 'partner') ? 'In partnership with' : 'Supported by'}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${sponsors.map(s => logoCell(s.org, sponsors.some(x => x.role !== s.role) ? s.role : null, s.primary, logoSrc[s.org.id])).join('')}</tr></table></td></tr>`
    : ''
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjectOf(ev))}</title></head>
<body style="margin:0;padding:0;background:#f1f3ff"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f3ff"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f1222">
<tr><td bgcolor="${accent}" style="background:${accent};padding:16px 24px;font:700 15px Arial,sans-serif;letter-spacing:.08em;color:${onAccent}">BLUE SCIENCE PARK <span style="font-weight:400;opacity:.85">· via Fyyr</span></td></tr>
${showCover && layout === 'banner' ? `<tr><td style="padding:0"><img src="${esc(ev.cover)}" alt="" width="600" style="display:block;width:100%;height:auto;border:0"></td></tr>` : ''}
${sp}
<tr><td style="padding:18px 24px 4px"><h1 style="margin:0;font:700 ${layout === 'compact' ? 22 : 26}px/1.25 Arial,sans-serif;color:#0f1222">${esc(ev.title.trim() || 'Event title')}</h1>
${organiser ? `<p style="margin:6px 0 0;font:14px Arial,sans-serif;color:#6b7194">Organised by ${esc(organiser.name)}</p>` : ''}</td></tr>
${showCover && layout === 'standard' ? `<tr><td style="padding:12px 24px 0"><img src="${esc(ev.cover)}" alt="" width="552" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></td></tr>` : ''}
<tr><td style="padding:12px 24px 4px;font:16px/1.55 Arial,sans-serif;color:#2a2f4a">${esc(intro)}</td></tr>
<tr><td style="padding:12px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3e6f4;border-radius:12px">${rows.map(([k, v]) => `<tr><td valign="top" style="padding:9px 14px;width:110px;font:600 13px Arial,sans-serif;color:#6b7194">${esc(k)}</td><td valign="top" style="padding:9px 14px 9px 0;font:15px/1.45 Arial,sans-serif;color:#0f1222">${/^https?:/.test(v) ? `<a href="${esc(v)}" style="color:${accent}">${esc(v)}</a>` : esc(v)}</td></tr>`).join('')}</table></td></tr>
<tr><td align="center" style="padding:12px 24px 22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${accent}" style="border-radius:999px;background:${accent}"><a href="${esc(regHref(ev) || '#')}" style="display:inline-block;padding:14px 30px;font:700 16px Arial,sans-serif;color:${onAccent};text-decoration:none">${cta}</a></td></tr></table></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e3e6f4;font:12.5px/1.6 Arial,sans-serif;color:#6b7194">Questions? Contact ${esc(CONTACT.name)} at <a href="mailto:${CONTACT.email}" style="color:#6b7194">${CONTACT.email}</a>.<br>You get this because you are a contact for a Blue Science Park member company. <a href="${TOKENS.preferences}" style="color:#6b7194">Email preferences</a> · <a href="${TOKENS.unsubscribe}" style="color:#6b7194">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`
  const text = [
    subjectOf(ev), '', intro, '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '',
    ...(sponsors.length ? [`${sponsors.every(s => s.role === 'partner') ? 'In partnership with' : 'Supported by'}: ${sponsors.map(s => s.org.name + (sponsors.some(x => x.role !== s.role) ? ` (${ROLES[s.role]})` : '')).join(', ')}`] : []),
    ...(organiser ? [`Organised by: ${organiser.name}`] : []),
    '', `${inv.buttonLabel || 'Register now'}: ${regHref(ev)}`, '',
    `Questions? ${CONTACT.name}, ${CONTACT.email}`, `Email preferences: ${TOKENS.preferences}`, `Unsubscribe: ${TOKENS.unsubscribe}`,
  ].join('\n')
  return { subject: subjectOf(ev), html, text }
}
