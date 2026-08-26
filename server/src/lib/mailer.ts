import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env';
import { formatDa } from './format';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.mail.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

export interface OrderMailLine {
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderMailPayload {
  reference: string;
  customerName: string;
  customerPhone: string;
  customerWilaya: string;
  customerAddress: string;
  customerNote?: string | null;
  total: number;
  items: OrderMailLine[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(order: OrderMailPayload): string {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.label)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatDa(item.unitPrice)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatDa(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <h2 style="color:#12386e">Nouvelle commande ${escapeHtml(order.reference)}</h2>
    <h3>Client</h3>
    <p>
      <strong>Nom :</strong> ${escapeHtml(order.customerName)}<br/>
      <strong>Téléphone :</strong> ${escapeHtml(order.customerPhone)}<br/>
      <strong>Wilaya :</strong> ${escapeHtml(order.customerWilaya)}<br/>
      <strong>Adresse :</strong> ${escapeHtml(order.customerAddress)}
      ${order.customerNote ? `<br/><strong>Note :</strong> ${escapeHtml(order.customerNote)}` : ''}
    </p>
    <h3>Articles</h3>
    <table style="border-collapse:collapse;width:100%;max-width:640px">
      <thead>
        <tr style="background:#12386e;color:#fff">
          <th style="padding:8px;text-align:left">Article</th>
          <th style="padding:8px">Qté</th>
          <th style="padding:8px;text-align:right">P.U.</th>
          <th style="padding:8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:18px"><strong>Total : ${formatDa(order.total)}</strong></p>
    <p style="color:#64748b">Livraison à préparer via Yalidine.</p>
  </div>`;
}

function buildText(order: OrderMailPayload): string {
  const lines = order.items
    .map((i) => `- ${i.label} x${i.quantity} @ ${formatDa(i.unitPrice)} = ${formatDa(i.unitPrice * i.quantity)}`)
    .join('\n');
  return [
    `Nouvelle commande ${order.reference}`,
    '',
    `Nom      : ${order.customerName}`,
    `Téléphone: ${order.customerPhone}`,
    `Wilaya   : ${order.customerWilaya}`,
    `Adresse  : ${order.customerAddress}`,
    order.customerNote ? `Note     : ${order.customerNote}` : '',
    '',
    'Articles :',
    lines,
    '',
    `TOTAL : ${formatDa(order.total)}`,
    '',
    'Livraison à préparer via Yalidine.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Notifie le propriétaire d'une nouvelle commande.
 * Sans SMTP configuré (dev), le message est simplement journalisé — l'échec d'un
 * envoi ne doit jamais faire échouer l'enregistrement de la commande.
 */
export async function sendOrderNotification(order: OrderMailPayload): Promise<void> {
  const mailer = getTransporter();
  const subject = `Nouvelle commande ${order.reference} — ${order.customerWilaya} — ${formatDa(order.total)}`;

  if (!mailer) {
    console.info(`[mail:console] ${subject}\n${buildText(order)}`);
    return;
  }

  try {
    await mailer.sendMail({
      from: env.mail.from,
      to: env.mail.notificationTo,
      subject,
      text: buildText(order),
      html: buildHtml(order),
    });
  } catch (error) {
    console.error("[mail] échec de l'envoi de la notification de commande", error);
  }
}
