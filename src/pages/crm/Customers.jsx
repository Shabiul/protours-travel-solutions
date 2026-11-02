import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, MessageCircle, Phone, RefreshCw, Search } from 'lucide-react'

import { crm } from './api.js'
import { BOOKING_STATUS, Card, Drawer, ENQUIRY_STATUS, Empty, Err, Pager, Pill, ServiceTag, ago, btnLight, dayLabel, inr, input, mailTo, waTo } from './ui.jsx'

/** The key a customer is filed under: the last 10 digits of the phone, or the e-mail when there is no phone. */
const keyOf = (c) => {
  const d = String(c.phone || '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : String(c.email || '').toLowerCase()
}

/** Everyone we have dealt with: flight customers and enquirers in one list, matched by phone or e-mail. */
export default function Customers({ onOpenBooking, onOpenEnquiry }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(async () => { setBusy(true); setErr(''); try { setData(await crm('customers', { q: dq, page })) } catch (e) { setErr(e.message) } finally { setBusy(false) } }, [dq, page])
  useEffect(() => { load() }, [load])
  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative block"><span className="sr-only">Search customers</span><Search size={16} className="absolute top-3 left-3 text-slate-400" /><input className={`${input} pl-9`} placeholder="Name, phone or e-mail" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className={btnLight} onClick={load} aria-label="Refresh"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button>
        </div>
        <p className="mt-2 text-[0.8rem] text-slate-500">One row per person: their flight bookings and their enquiries are joined by phone number (or e-mail).</p>
      </Card>
      <Err>{err}</Err>
      {!data ? <Empty><Loader2 className="mx-auto animate-spin" /></Empty> : !data.rows.length ? <Empty>No customers match.</Empty> : (
        <ul className="grid gap-2">
          {data.rows.map((c) => (
            <li key={keyOf(c)}>
              <button onClick={() => setOpen(c)} className="grid w-full gap-1 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 md:grid-cols-[1.2fr_1fr_auto] md:items-center md:gap-4">
                <span><span className="block font-semibold text-ink">{c.name || '—'}</span><span className="text-[0.82rem] text-slate-500">{c.phone || ''}{c.phone && c.email ? ' · ' : ''}{c.email || ''}</span></span>
                <span className="flex flex-wrap gap-1">{(c.services || []).map((s) => <ServiceTag key={s} service={s} />)}</span>
                <span className="text-[0.8rem] text-slate-600 md:text-right"><span className="block font-bold text-navy-900">{inr(c.spent)} spent</span>{c.bookings} booking{c.bookings === 1 ? '' : 's'} · {c.enquiries} enquir{c.enquiries === 1 ? 'y' : 'ies'} · {ago(c.last_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      {open && <CustomerDrawer c={open} onClose={() => setOpen(null)} onBooking={(id) => { setOpen(null); onOpenBooking(id) }} onEnquiry={(id) => { setOpen(null); onOpenEnquiry(id) }} />}
    </div>
  )
}

function CustomerDrawer({ c, onClose, onBooking, onEnquiry }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { crm('customer', { key: keyOf(c) }).then(setD).catch((e) => setErr(e.message)) }, [c])
  return (
    <Drawer title={c.name || 'Customer'} onClose={onClose}>
      <div className="grid gap-4">
        <Card title="Contact">
          <p className="text-[0.92rem] text-slate-700">{c.phone || '—'}{c.email ? ` · ${c.email}` : ''}</p>
          <p className="mt-1 text-[0.85rem] text-slate-500">{inr(c.spent)} spent in total · {c.bookings} booking{c.bookings === 1 ? '' : 's'} · {c.enquiries} enquir{c.enquiries === 1 ? 'y' : 'ies'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.phone && <a className={btnLight} href={waTo(c.phone, `Hi ${c.name || ''}`)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
            {c.phone && <a className={btnLight} href={`tel:${c.phone}`}><Phone size={16} /> Call</a>}
            {c.email && <a className={btnLight} href={mailTo(c.email)}><Mail size={16} /> E-mail</a>}
          </div>
        </Card>
        {!d ? (err ? <Err>{err}</Err> : <Loader2 className="mx-auto animate-spin" />) : (
          <>
            <Card title={`Flight bookings (${d.bookings.length})`}>
              {!d.bookings.length ? <p className="text-[0.9rem] text-slate-500">None.</p> : <ul className="grid gap-1">{d.bookings.map((b) => <li key={b.id}><button className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sand" onClick={() => onBooking(b.id)}><span><span className="font-mono text-[0.8rem]">{b.order_ref}</span> <span className="text-[0.85rem] text-slate-600">{b.route} · {dayLabel(b.travel_date)} · {inr(b.amount_inr)}</span></span><Pill status={b.status} map={BOOKING_STATUS} /></button></li>)}</ul>}
            </Card>
            <Card title={`Enquiries (${d.enquiries.length})`}>
              {!d.enquiries.length ? <p className="text-[0.9rem] text-slate-500">None.</p> : <ul className="grid gap-1">{d.enquiries.map((e) => <li key={e.id}><button className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sand" onClick={() => onEnquiry(e.id)}><span className="min-w-0"><ServiceTag service={e.service} /> <span className="text-[0.85rem] text-slate-600">{e.topic || ''}{e.final_inr ? ` · ${inr(e.final_inr)}` : e.quoted_inr ? ` · quoted ${inr(e.quoted_inr)}` : ''} · {ago(e.created_at)}</span></span><Pill status={e.status} map={ENQUIRY_STATUS} /></button></li>)}</ul>}
            </Card>
          </>
        )}
      </div>
    </Drawer>
  )
}
