import rateLimit from 'express-rate-limit';

/**
 * Limitations de débit. But : couper le bourrage de mot de passe sur la connexion
 * et le spam d'écritures publiques (commandes, tracking), sans gêner un usage normal.
 *
 * Les compteurs sont en mémoire : suffisant pour une instance unique. Derrière un
 * répartiteur de charge multi-instances, brancher un store partagé (Redis).
 */

const standardHeaders = true;
const legacyHeaders = false;

/** Connexion admin : défense contre le bourrage d'identifiants. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders,
  legacyHeaders,
  // On ne compte que les tentatives échouées : un admin légitime n'est pas bloqué.
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

/** Création de commande : borne le spam tout en laissant passer un vrai client. */
export const orderRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Trop de commandes envoyées. Patientez une minute.' },
});

/** Suivi de commande : borne l'énumération des références. */
export const lookupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Trop de recherches. Patientez une minute.' },
});

/** Tracking d'audience : endpoint public à fort volume, plafond large. */
export const trackRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders,
  legacyHeaders,
  // Le tracking ne doit jamais renvoyer d'erreur visible : on absorbe silencieusement.
  handler: (_req, res) => res.status(204).end(),
});
