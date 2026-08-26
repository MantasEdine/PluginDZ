import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../env';
import { HttpError } from '../lib/http-error';
import { requireAdmin } from '../middleware/auth';
import { slugify } from '../lib/slug';

export const uploadsRouter = Router();

fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, env.uploadDir),
    filename: (_req, file, cb) => {
      const extension = ALLOWED.get(file.mimetype) ?? '.bin';
      const base = slugify(path.parse(file.originalname).name).slice(0, 40) || 'image';
      // Suffixe aléatoire : évite les collisions et empêche de deviner les URLs.
      cb(null, `${base}-${crypto.randomBytes(6).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(HttpError.badRequest('Format non supporté (JPG, PNG, WEBP, AVIF ou GIF)'));
      return;
    }
    cb(null, true);
  },
});

/** Upload d'une image depuis le back-office. Renvoie l'URL publique à stocker. */
uploadsRouter.post('/', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(HttpError.badRequest(`Fichier trop volumineux (max ${env.maxUploadBytes / 1024 / 1024} Mo)`));
        return;
      }
      next(error);
      return;
    }
    if (!req.file) {
      next(HttpError.badRequest('Aucun fichier reçu'));
      return;
    }
    res.status(201).json({
      data: {
        url: `${env.publicApiUrl}/uploads/${req.file.filename}`,
        path: `/uploads/${req.file.filename}`,
        size: req.file.size,
      },
    });
  });
});
