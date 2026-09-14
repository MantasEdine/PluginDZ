'use client';

import { useI18n } from './LocaleProvider';

/**
 * Bandeau de réassurance affiché tout en haut du site, avant l'en-tête.
 * Premier élément vu à l'arrivée : il répond aux trois questions que se pose
 * un acheteur algérien (est-ce authentique ? livrez-vous chez moi ? dois-je
 * payer d'avance ?). Toutes les promesses sont vraies — aucun label emprunté.
 */

function IconOriginal() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2.5 3.5 5v4.2c0 3.4 2.6 6.6 6.5 8.3 3.9-1.7 6.5-4.9 6.5-8.3V5L10 2.5Z" />
      <path d="m7.4 9.9 1.9 1.9 3.6-3.6" />
    </svg>
  );
}

function IconDelivery() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 5.2h9.4v8.2H1.8z" />
      <path d="M11.2 8.2h3.2l2.8 2.8v2.4h-6z" />
      <circle cx="5.4" cy="15.2" r="1.6" />
      <circle cx="14" cy="15.2" r="1.6" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.8" y="4.8" width="16.4" height="10.4" rx="1.6" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 8.6a6.8 6.8 0 0 1 13.6 0" />
      <path d="M3.2 9.4h1.6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4.4a1.2 1.2 0 0 1-1.2-1.2z" />
      <path d="M16.8 9.4h-1.6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h.4a1.2 1.2 0 0 0 1.2-1.2z" />
    </svg>
  );
}

export function TrustBar() {
  const { t } = useI18n();

  const items = [
    { icon: <IconOriginal />, label: t('trust.original') },
    { icon: <IconDelivery />, label: t('trust.delivery') },
    { icon: <IconCash />, label: t('trust.cod') },
    { icon: <IconSupport />, label: t('trust.support') },
  ];

  return (
    <div className="bg-navy-900 text-white">
      {/* Défilement horizontal sur petit écran plutôt qu'un retour à la ligne disgracieux. */}
      <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 py-2 text-[11px] font-medium sm:justify-center sm:gap-8 sm:text-xs">
        {items.map((item, index) => (
          <span key={index} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-white/85">
            <span className="text-plug-400">{item.icon}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
