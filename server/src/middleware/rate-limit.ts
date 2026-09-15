import rateLimit from 'express-rate-limit';

/**
 * Limitations de débit.
 *
 * Contrainte importante : en Algérie, l'essentiel du trafic mobile passe par le NAT
 * des opérateurs — des centaines de clients réels partagent la même adresse IP. Une
 * limite « par IP » serrée ne bloque donc pas un attaquant, elle bloque un quartier
 * entier. Les plafonds ci-dessous sont donc larges : ils arrêtent un script emballé
 * (des milliers d'appels) sans jamais gêner des acheteurs humains, même pendant un
 * pic venu des réseaux sociaux.
 *
 * Les compteurs sont en mémoire : suffisant pour une instance unique. Derrière un
 * répartiteur multi-instances, brancher un store partagé (Redis).
 */

const standardHeaders = true;
const legacyHeaders = false;

/**
 * Connexion admin : seul endpoint où l'on reste strict, car c'est la porte du
 * back-office. Seuls les échecs comptent, donc un propriétaire qui se trompe une
 * fois n'est pas pénalisé.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders,
  legacyHeaders,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

/**
 * Création de commande. Un client humain en passe une ; le plafond ne sert qu'à
 * stopper un script. 60/min laisse passer une vague de commandes venue d'une même
 * IP opérateur sans jamais refuser une vente.
 */
export const orderRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Trop de commandes envoyées. Patientez une minute.' },
});

/** Suivi de commande : borne l'énumération des références sans bloquer les clients. */
export const lookupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Trop de recherches. Patientez une minute.' },
});

/**
 * Tracking d'audience. Une visite = une insertion très bon marché, et ces données
 * pilotent les décisions publicitaires : les perdre coûte plus cher que de les
 * écrire. Plafond très large (20/s) pour encaisser des centaines de visiteurs
 * derrière une même IP opérateur.
 */
export const trackRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1200,
  standardHeaders,
  legacyHeaders,
  // Le tracking ne doit jamais renvoyer d'erreur au visiteur : on absorbe en 204.
  // On journalise en revanche, pour que la perte de données ne soit pas silencieuse.
  handler: (req, res) => {
    console.warn(`[track] limite de débit atteinte pour ${req.ip} — visite non enregistrée`);
    res.status(204).end();
  },
});
