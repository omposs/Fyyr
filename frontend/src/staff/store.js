import { useCallback, useEffect, useState } from 'react'

// Staff preferences and internal follow-up items. Stored in this browser only (prototype).
const SKEY = 'fyyr.staff.settings.v1'
const FKEY = 'fyyr.staff.followups.v1'
export const STATUSES = ['New', 'Reviewing', 'Planned', 'Completed']
export const DEFAULT_K = 3
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }

export function useStaffStore(email) {
  const [settings, setSettings] = useState(() => ({ k: DEFAULT_K, ...read(SKEY, {}) }))
  const [items, setItems] = useState(() => { const v = read(FKEY, []); return Array.isArray(v) ? v : [] })
  useEffect(() => { write(SKEY, settings) }, [settings])
  useEffect(() => { write(FKEY, items) }, [items])
  const add = useCallback(it => setItems(x => [{ id: 'f' + Date.now().toString(36), created: Date.now(), status: 'New', owner: email || '', ...it }, ...x]), [email])
  return {
    k: settings.k, setK: k => setSettings(s => ({ ...s, k })),
    items,
    add,
    update: (id, patch) => setItems(x => x.map(i => (i.id === id ? { ...i, ...patch } : i))),
    remove: id => setItems(x => x.filter(i => i.id !== id)),
    has: key => items.some(i => i.key === key),
  }
}
