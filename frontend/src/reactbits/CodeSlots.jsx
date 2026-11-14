import { useRef } from 'react'
import './CodeSlots.css'

// Six-digit code input: typing, paste, backspace, arrows/home/end, auto-complete callback.
// status="success" plays a brief staggered pop (disabled by prefers-reduced-motion in CSS).
export default function CodeSlots({ length = 6, onComplete, status = 'idle', disabled = false, label = 'Verification code' }) {
  const refs = useRef([])
  const vals = useRef(Array(length).fill(''))
  const focus = i => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  const commit = () => { if (vals.current.every(Boolean)) onComplete?.(vals.current.join('')) }
  const fill = (start, digits) => {
    let i = start
    for (const d of digits) { if (i >= length) break; vals.current[i] = d; refs.current[i].value = d; i++ }
    focus(i)
    commit()
  }

  const onChange = (i, e) => {
    const digits = e.target.value.replace(/\D/g, '')
    e.target.value = vals.current[i] // controlled by refs; fill() writes the new values
    if (digits) fill(i, digits)
  }
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (vals.current[i]) { vals.current[i] = ''; refs.current[i].value = '' } else if (i > 0) { vals.current[i - 1] = ''; refs.current[i - 1].value = ''; focus(i - 1) }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1) }
    else if (e.key === 'Home') { e.preventDefault(); focus(0) }
    else if (e.key === 'End') { e.preventDefault(); focus(length - 1) }
  }
  const onPaste = (i, e) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '')
    if (digits) fill(digits.length >= length ? 0 : i, digits.slice(0, length))
  }

  return (
    <div className={`slots ${status === 'success' ? 'is-success' : ''}`} role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i} ref={el => (refs.current[i] = el)} className="slot" style={{ '--i': i }}
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={length} defaultValue=""
          autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1} of ${length}`}
          disabled={disabled} onChange={e => onChange(i, e)} onKeyDown={e => onKeyDown(i, e)} onPaste={e => onPaste(i, e)}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  )
}
