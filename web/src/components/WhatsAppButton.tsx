'use client';

import { usePathname } from 'next/navigation';
import { useI18n } from './LocaleProvider';
import { IconWhatsApp } from './SocialIcons';
import { whatsappLink } from '@/lib/contact';

/**
 * Bouton WhatsApp flottant.
 *
 * En Algérie, beaucoup d'acheteurs veulent poser une question (taille, compatibilité,
 * délai) avant de commander, et ils la posent sur WhatsApp. Sans ce raccourci, la
 * question ne se pose pas : la visite s'arrête là.
 *
 * Placé en bas à l'opposé du sens de lecture (à droite en français, à gauche en arabe)
 * pour ne jamais recouvrir le bouton principal d'une page. Cible de 56 px : au-dessus
 * des 44 px recommandés, car on l'atteint au pouce, en marchant.
 *
 * Absent du back-office : il s'adresse aux clients, et un bouton flottant y
 * recouvrirait les formulaires de gestion.
 */
export function WhatsAppButton() {
  const { t } = useI18n();
  const pathname = usePathname();
  const label = t('whatsapp.aria');

  if (pathname?.startsWith('/admin')) return null;

  return (
    <a
      href={whatsappLink(t('whatsapp.prefill'))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="fixed bottom-4 end-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full
                 bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:brightness-110
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-[#25D366]"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <IconWhatsApp className="h-7 w-7" />
    </a>
  );
}
