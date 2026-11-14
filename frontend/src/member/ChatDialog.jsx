import { useRef, useState } from 'react'
import * as api from '../api/api.js'
import { errorText } from '../api/client.js'
import { Dialog } from './ui.jsx'

// Live mode only: asks POST /me/chat. The server decides what the model may see; replies are shown as plain text (never HTML).
// Built from the existing dialog and form styles. Blocked answers are labelled as such.
export default function ChatDialog({ chat, setChat, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const guard = useRef(false)
  const send = async e => {
    e.preventDefault()
    const message = text.trim()
    if (!message || guard.current) return
    guard.current = true; setBusy(true); setError(null)
    try {
      const out = await api.chat(message, chat.sid)
      setChat(s => ({ sid: out.session_id, msgs: [...s.msgs, { from: 'You', text: message }, { from: out.blocked ? 'Assistant (not answered)' : 'Assistant', text: out.reply }] }))
      setText('')
    } catch (err) { setError(err) } finally { guard.current = false; setBusy(false) }
  }
  return (
    <Dialog label="Assistant" onClose={onClose}>
      <h2 className="auth-h int-h">Assistant</h2>
      <p className="auth-sub int-sub">Ask about your profile, your recommendations or your company matches. Answers can be wrong: check details at the source.</p>
      {chat.msgs.length > 0 && <ul className="mem-dl" aria-live="polite">{chat.msgs.map((m, i) => <li key={i}><b>{m.from}</b><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.text}</p></li>)}</ul>}
      <form className="int-add" onSubmit={send}>
        <label className="sr" htmlFor="chat-in">Your message</label>
        <input id="chat-in" data-af type="text" maxLength={2000} autoComplete="off" value={text} placeholder="e.g. Why is my top match relevant?" onChange={e => { setText(e.target.value); setError(null) }} disabled={busy} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button>
      </form>
      {error && <p className="auth-err" role="alert">{errorText(error)} Your message was not sent.</p>}
    </Dialog>
  )
}
