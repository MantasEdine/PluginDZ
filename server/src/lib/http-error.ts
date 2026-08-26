/** Erreur applicative portant un code HTTP et un message déjà en français. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, message, details);
  }
  static unauthorized(message = 'Authentification requise') {
    return new HttpError(401, message);
  }
  static forbidden(message = 'Accès refusé') {
    return new HttpError(403, message);
  }
  static notFound(message = 'Ressource introuvable') {
    return new HttpError(404, message);
  }
  static conflict(message: string) {
    return new HttpError(409, message);
  }
}
