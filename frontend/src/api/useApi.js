import { useCallback, useEffect, useRef, useState } from 'react'

// Runs fn(signal) when deps change or reload() is called. A newer run cancels the previous one and a late answer from an
// older run can never overwrite newer state. Cancelled runs are silent. Data from the previous run stays visible while reloading.
export function useAsync(fn, deps) {
  const [s, setS] = useState({ data: undefined, error: null, loading: true })
  const run = useRef(0)
  const ctl = useRef(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const load = useCallback(() => {
    ctl.current?.abort()
    const c = (ctl.current = new AbortController())
    const id = ++run.current
    setS(x => ({ ...x, error: null, loading: true }))
    fnRef.current(c.signal).then(
      data => { if (id === run.current) setS({ data, error: null, loading: false }) },
      error => { if (id === run.current && error?.name !== 'AbortError') setS(x => ({ ...x, error, loading: false })) },
    )
  }, [])
  useEffect(() => { load(); return () => { run.current++; ctl.current?.abort() } }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload: load }
}

// Guards a button/form against double submission and reports the result only after the server answered.
export function useAction() {
  const [state, setState] = useState({ busy: false, error: null })
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const run = useCallback(async fn => {
    if (busy.current) return undefined
    busy.current = true
    setState({ busy: true, error: null })
    try {
      const out = await fn()
      if (alive.current) setState({ busy: false, error: null })
      return { ok: true, value: out }
    } catch (error) {
      if (alive.current) setState({ busy: false, error })
      return { ok: false, error }
    } finally { busy.current = false }
  }, [])
  return { ...state, run, clearError: () => setState(s => ({ ...s, error: null })) }
}
