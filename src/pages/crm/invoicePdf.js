/* Invoice PDF, built in the browser with jsPDF (loaded only when someone presses Download). The numbers come from the saved invoice
   (the database worked them out), never recomputed here. Plain A4, the same letterhead as the e-ticket. */
import { logoDataUrl } from '../flights/ticket.js'

const plain = (v) => String(v ?? '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NAVY = [8, 28, 52], GREY = [90, 100, 112], LINE = [210, 214, 220], BLUE = [15, 94, 158]
const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }

export async function downloadInvoice({ invoice: i, business: b }) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), logoDataUrl()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, M = 14
  let y = 12
  if (logo) doc.addImage(logo, 'JPEG', M, y, 60, 60 * (209 / 1200), 'logo', 'FAST')
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(9).text(plain(b.legal_name).toUpperCase(), W - M, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...GREY)
  const head = [b.address, b.phone && `Mob: ${b.phone}`, b.email && `Email: ${b.email}`, b.gstin && `GSTIN: ${b.gstin}`, b.pan && `PAN: ${b.pan}`].filter(Boolean)
  doc.splitTextToSize(head.map(plain).join('\n'), 95).forEach((l, k) => doc.text(l, W - M, y + 6.5 + k * 3.6, { align: 'right' }))
  y = 38
  doc.setDrawColor(...BLUE).setLineWidth(0.6).line(M, y, W - M, y)

  y += 9
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(15).text(i.status === 'cancelled' ? 'INVOICE (CANCELLED)' : b.gstin ? 'TAX INVOICE' : 'INVOICE', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GREY)
  doc.text(`Invoice no: ${plain(i.invoice_no)}`, W - M, y - 3, { align: 'right' })
  doc.text(`Date: ${dmy(i.issued_on)}`, W - M, y + 2, { align: 'right' })

  y += 10
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...BLUE).text('BILLED TO', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...NAVY)
  const to = [i.customer_name, i.address, i.phone, i.email, i.customer_gstin && `GSTIN: ${i.customer_gstin}`].filter(Boolean).map(plain)
  doc.splitTextToSize(to.join('\n'), 100).forEach((l, k) => doc.text(l, M, y + 5 + k * 4.6))
  y += 8 + Math.max(1, to.length) * 4.8 + 4

  doc.setFillColor(238, 243, 249).rect(M, y, W - 2 * M, 7.5, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY)
  doc.text('DESCRIPTION', M + 3, y + 5).text('QTY', 118, y + 5, { align: 'right' }).text('RATE (INR)', 150, y + 5, { align: 'right' }).text('AMOUNT (INR)', W - M - 3, y + 5, { align: 'right' })
  y += 7.5
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...NAVY)
  for (const l of i.lines || []) {
    const rows = doc.splitTextToSize(plain(l.desc), 92)
    doc.text(rows, M + 3, y + 6)
    doc.text(String(Number(l.qty)), 118, y + 6, { align: 'right' }).text(money(l.rate), 150, y + 6, { align: 'right' }).text(money(l.amount), W - M - 3, y + 6, { align: 'right' })
    const h = Math.max(9, rows.length * 4.6 + 4)
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, y + h, W - M, y + h)
    y += h
    if (y > 245) { doc.addPage(); y = 20 }
  }

  y += 6
  const row = (label, value, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 9.5).setTextColor(...NAVY); doc.text(label, 140, y, { align: 'right' }).text(value, W - M - 3, y, { align: 'right' }); y += bold ? 7 : 5.5 }
  row('Sub-total', money(i.subtotal))
  if (Number(i.gst_percent) > 0) row(`GST @ ${Number(i.gst_percent)}%`, money(i.gst_amount))
  doc.setDrawColor(...BLUE).setLineWidth(0.4).line(100, y - 3, W - M, y - 3)
  row('Total (INR)', money(i.total), true)

  y += 8
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
  const notes = [i.notes && plain(i.notes.replace(/\nCancelled by[\s\S]*$/, '')), b.terms && plain(b.terms), 'This is a computer-generated invoice and does not need a signature.'].filter(Boolean)
  doc.text(doc.splitTextToSize(notes.join('\n'), W - 2 * M), M, y)
  if (i.status === 'cancelled') doc.setTextColor(200, 30, 30).setFont('helvetica', 'bold').setFontSize(40).text('CANCELLED', W / 2, 150, { align: 'center', angle: 25 })
  doc.save(`Invoice-${plain(i.invoice_no).replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`)
}
