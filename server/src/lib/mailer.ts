import { env } from '../env';
import { formatDa } from './format';

/**
 * Notification de commande par email, via Resend (https://resend.com).
 *
 * Resend est une API HTTP : on envoie une simple requête POST avec la clé API, et
 * Resend se charge de livrer l'email. Pas de serveur SMTP à gérer. Si aucune clé
 * n'est configurée (développement local), l'email est simplement journalisé.
 *
 * Un échec d'envoi ne doit JAMAIS faire échouer l'enregistrement de la commande :
 * tout est encapsulé et les erreurs sont seulement journalisées.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

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
 * Avec une clé Resend configurée : envoi réel. Sinon : journalisation (dev).
 */
export async function sendOrderNotification(order: OrderMailPayload): Promise<void> {
  const subject = `Nouvelle commande ${order.reference} — ${order.customerWilaya} — ${formatDa(order.total)}`;

  if (!env.mail.resendApiKey) {
    // Pas de clé : on n'envoie rien, on journalise (utile en développement local).
    console.info(`[mail:console] ${subject}\n${buildText(order)}`);
    return;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.mail.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mail.from,
        to: [env.mail.notificationTo],
        subject,
        html: buildHtml(order),
        text: buildText(order),
      }),
    });

    if (!response.ok) {
      // Resend renvoie un JSON d'erreur (domaine non vérifié, clé invalide, etc.).
      const detail = await response.text().catch(() => '');
      console.error(`[mail] Resend a refusé l'envoi (${response.status}) : ${detail}`);
    }
  } catch (error) {
    console.error("[mail] échec de l'envoi de la notification de commande", error);
  }
}


export interface MailDiagnostic {
  resendConfigured: boolean;
  from: string;
  to: string;
  status?: number;
  ok?: boolean;
  detail?: string;
}

/**
 * Diagnostic d'envoi : envoie un email de test via Resend et renvoie la réponse brute
 * (statut + message). Sert au bouton « Tester l'email » du back-office pour voir
 * immédiatement pourquoi un envoi échoue (clé absente, destinataire refusé, domaine
 * non vérifié...). Ne révèle jamais la clé API.
 */
export async function sendTestEmail(): Promise<MailDiagnostic> {
  const base: MailDiagnostic = {
    resendConfigured: Boolean(env.mail.resendApiKey),
    from: env.mail.from,
    to: env.mail.notificationTo,
  };

  if (!env.mail.resendApiKey) {
    return { ...base, ok: false, detail: "RESEND_API_KEY absente : aucun email n'est envoyé (mode journal)." };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.mail.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mail.from,
        to: [env.mail.notificationTo],
        subject: 'Test Plugin.dz — configuration des emails',
        text: 'Ceci est un email de test envoyé depuis le back-office Plugin.dz. Si vous le recevez, les notifications de commande fonctionnent.',
        html: '<p>Ceci est un email de test envoyé depuis le back-office <strong>Plugin.dz</strong>.</p><p>Si vous le recevez, les notifications de commande fonctionnent.</p>',
      }),
    });
    const detail = (await response.text().catch(() => '')).slice(0, 400);
    return { ...base, ok: response.ok, status: response.status, detail };
  } catch (error) {
    return { ...base, ok: false, detail: `Erreur réseau : ${String(error).slice(0, 200)}` };
  }
}
