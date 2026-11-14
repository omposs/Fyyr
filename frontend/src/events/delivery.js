// ---- Email delivery adapter ----
// No email service is connected in this prototype, so sending is UNAVAILABLE and nothing is ever reported as sent.
// To connect one, implement `send` (and optionally `testSend`) server-side and flip `connected`. The UI reads only this file.
export const delivery = {
  connected: false,
  reason: 'No email service is connected to this prototype, so invitations cannot be sent or scheduled. You can prepare, preview and save everything here.',
  // Tracking is only shown when delivery is connected: delivery status, failures, link clicks, and registrations the registration
  // system confirms. A link click is never counted as a registration.
  tracks: ['Delivery status', 'Failed deliveries', 'Link clicks', 'Confirmed registrations (only if the registration system reports them)'],
}
export class DeliveryUnavailable extends Error {}

// Stable key for "this exact invitation to this exact audience". A real sender must refuse a key it has already accepted,
// which prevents accidental duplicate sends.
export function sendKey(ev, recipients) {
  const s = [ev.id, ev.title, ev.date, ev.regUrl.trim(), JSON.stringify(ev.invite), recipients.map(r => r.email.toLowerCase()).sort().join(',')].join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return 'send-' + h.toString(36)
}
export async function send() { throw new DeliveryUnavailable(delivery.reason) }
export const testSend = send
