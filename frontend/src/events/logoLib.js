import { useSyncExternalStore } from 'react'

// ---- Shared organisation + logo library ----
// One record per organisation (name, website, optional logo). Events reference organisations by id, so a logo is uploaded once
// and reused everywhere (cards, details, invitations). Stored in this browser (prototype); the same shape fits a server table.
const KEY = 'fyyr.orgs.v1'
export const ROLES = { organiser: 'Organiser', sponsor: 'Sponsor', partner: 'Partner' }
export const MAX_BYTES = 2 * 1024 * 1024
export const MAX_SVG_BYTES = 200 * 1024

// ---- tiny external store ----
let raw = null, cache = []
const subs = new Set()
function read() {
  let r = null
  try { r = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (r !== raw) { raw = r; try { const v = JSON.parse(r); cache = Array.isArray(v) ? v : [] } catch { cache = [] } }
  return cache
}
function write(list) {
  const s = JSON.stringify(list)
  try { localStorage.setItem(KEY, s) } catch { throw new Error('Could not save: browser storage is full or unavailable. Try a smaller logo.') }
  raw = s; cache = list; subs.forEach(f => f())
}
window.addEventListener('storage', e => { if (e.key === KEY) subs.forEach(f => f()) })
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
export const useOrgs = () => useSyncExternalStore(subscribe, read)
export const getOrg = id => read().find(o => o.id === id) || null
export const listOrgs = read

const uid = () => 'org-' + Math.random().toString(36).slice(2, 9)
export function saveOrg(org) {
  const list = read()
  const name = (org.name || '').trim()
  if (!name) throw new Error('Add an organisation name.')
  const rec = { ...org, name, website: normaliseUrl(org.website), id: org.id || uid(), updated: Date.now() }
  write(list.some(o => o.id === rec.id) ? list.map(o => (o.id === rec.id ? rec : o)) : [...list, rec])
  return rec
}
export function deleteOrg(id) { write(read().filter(o => o.id !== id)) }

export function normaliseUrl(u) {
  const t = (u || '').trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : 'https://' + t
}
export const validUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' } catch { return false } }

// ---- SVG sanitising (allowlist). Anything not listed is removed; scripts, event handlers, external references never survive. ----
const SVG_EL = new Set('svg g path rect circle ellipse line polyline polygon defs lineargradient radialgradient stop clippath mask use title desc text tspan symbol style'.split(' '))
const SVG_ATTR = new Set('viewbox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill fill-opacity fill-rule clip-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity opacity transform id class offset stop-color stop-opacity gradientunits gradienttransform fx fy clip-path mask maskunits maskcontentunits preserveaspectratio xmlns font-family font-size font-weight text-anchor dx dy style href xlink:href xmlns:xlink version spreadmethod patternunits'.split(' '))

export function sanitiseSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName.toLowerCase() !== 'svg') throw new Error('This SVG could not be read. Export it again from your design tool, or use a PNG.')
  let removed = 0
  const walk = el => {
    for (const ch of [...el.children]) {
      if (!SVG_EL.has(ch.localName.toLowerCase())) { ch.remove(); removed++; continue }
      if (ch.localName.toLowerCase() === 'style' && /@import|url\(\s*['"]?(?!#)|expression\(|javascript:/i.test(ch.textContent)) { ch.remove(); removed++; continue }
      walk(ch)
    }
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value
      const bad = n.startsWith('on') || !SVG_ATTR.has(n) && !n.startsWith('xmlns') ||
        /javascript:|data:|expression\(/i.test(v) ||
        ((n === 'href' || n === 'xlink:href') && !v.startsWith('#')) ||
        (n === 'style' && /url\(\s*['"]?(?!#)|@import|expression\(/i.test(v))
      if (bad) { el.removeAttribute(a.name); removed++ }
    }
  }
  walk(doc.documentElement)
  const root = doc.documentElement
  let w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'))
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) { if (!(w > 0) || !(h > 0)) { w = vb[2]; h = vb[3] } }
  else if (w > 0 && h > 0) root.setAttribute('viewBox', `0 0 ${w} ${h}`)
  else throw new Error('This SVG has no size (no viewBox or width and height). Export it again with a size, or use a PNG.')
  root.removeAttribute('width'); root.removeAttribute('height')
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return { svg: new XMLSerializer().serializeToString(root), w, h, removed }
}

// ---- file validation + loading ----
const sniff = b => {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return null
}
const readBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('The file could not be read.')); r.readAsArrayBuffer(f) })
const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('The file could not be read.')); r.readAsDataURL(blob) })
export const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This image could not be opened. It may be damaged. Try exporting it again.')); i.src = src })

// Luminance of the opaque pixels, 0 (dark) to 1 (light). Used to suggest a light or dark backing.
async function lumaOf(src) {
  try {
    const img = await loadImg(src)
    const s = Math.min(1, 96 / Math.max(img.width, img.height, 1))
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s))
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let sum = 0, n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++ }
    return n ? sum / n : 0.5
  } catch { return 0.5 }
}

// Returns { logo, notes } or throws an Error with a message staff can act on.
export async function readLogoFile(file) {
  if (!file) throw new Error('Choose an image file.')
  if (file.size === 0) throw new Error('This file is empty.')
  const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name)
  if (isSvg) {
    if (file.size > MAX_SVG_BYTES) throw new Error(`This SVG is ${(file.size / 1024).toFixed(0)} KB. SVG logos must be under ${MAX_SVG_BYTES / 1024} KB. Simplify it or use a PNG.`)
    const { svg, w, h, removed } = sanitiseSvg(await file.text())
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    const luma = await lumaOf(src)
    return { logo: { src, kind: 'svg', w, h, bg: luma > 0.8 ? 'dark' : 'light', scale: 100, trimmed: false, original: null }, notes: removed ? [`Removed ${removed} unsafe or unsupported part${removed === 1 ? '' : 's'} from the SVG. Check the preview still looks right.`] : [] }
  }
  if (file.size > MAX_BYTES) throw new Error(`This file is ${(file.size / 1048576).toFixed(1)} MB. Logos must be under ${MAX_BYTES / 1048576} MB. Export a smaller PNG or use SVG.`)
  const kind = sniff(new Uint8Array((await readBuf(file.slice(0, 16)))))
  if (!kind) throw new Error('This file type is not supported. Use PNG (transparent works best), JPG, WebP or SVG.')
  const src = await toDataUrl(file)
  const img = await loadImg(src)
  if (img.width < 2 || img.height < 2) throw new Error('This image is too small to use as a logo.')
  const notes = []
  if (kind !== 'svg' && Math.max(img.width, img.height) < 200) notes.push('This logo is small and may look blurry on high-resolution screens. A larger file or an SVG is better.')
  if (img.width / img.height > 6 || img.height / img.width > 3) notes.push('This logo has an unusual shape. It will be shown fully, without cropping, but may appear small.')
  const luma = await lumaOf(src)
  return { logo: { src, kind, w: img.width, h: img.height, bg: luma > 0.8 ? 'dark' : 'light', scale: 100, trimmed: false, original: null }, notes }
}

// ---- optional whitespace trim (raster only). Returns a new logo; the original is kept so it can be restored. ----
export async function trimLogo(logo) {
  if (logo.kind === 'svg') return null
  const base = logo.original || logo
  const img = await loadImg(base.src)
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const blank = i => d[i + 3] < 12 || (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245)
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (!blank((y * c.width + xx) * 4)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return null
  const pad = Math.round(Math.max(c.width, c.height) * 0.02)
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad)
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  if (w >= c.width - 2 && h >= c.height - 2) return null // nothing to trim
  const o = document.createElement('canvas'); o.width = w; o.height = h
  o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h)
  return { ...base, src: o.toDataURL('image/png'), kind: 'png', w, h, trimmed: true, original: { src: base.src, kind: base.kind, w: base.w, h: base.h }, scale: logo.scale, bg: logo.bg }
}
export const untrimLogo = logo => (logo.original ? { ...logo, ...logo.original, trimmed: false, original: null } : logo)

// ---- raster copy for email (many mail clients do not show SVG). Cached. ----
const rasterCache = new Map()
export async function rasterLogo(logo, maxW = 360, maxH = 120) {
  if (!logo) return null
  if (logo.kind !== 'svg') return logo.src
  const k = logo.src.length + ':' + logo.src.slice(-40) + maxW
  if (rasterCache.has(k)) return rasterCache.get(k)
  const img = await loadImg(logo.src)
  const ar = logo.w / logo.h || 1
  let w = Math.min(maxW * 2, 800), h = w / ar
  if (h > maxH * 2) { h = maxH * 2; w = h * ar }
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  const out = c.toDataURL('image/png')
  rasterCache.set(k, out)
  return out
}

// ---- search ----
export const searchOrgs = (list, q) => { const t = q.trim().toLowerCase(); return t ? list.filter(o => o.name.toLowerCase().includes(t) || (o.website || '').toLowerCase().includes(t)) : list }
