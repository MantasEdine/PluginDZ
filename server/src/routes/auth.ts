import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, signAdminToken } from '../middleware/auth';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.adminUser.findUnique({ where: { email } });

    // Message identique dans les deux cas : on n'indique pas si l'email existe.
    const invalid = HttpError.unauthorized('Email ou mot de passe incorrect');
    if (!user || !user.isActive) throw invalid;
    if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid;

    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signAdminToken({
      adminId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.json({
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  }),
);

authRouter.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = req.admin;
    if (!admin) throw HttpError.unauthorized();
    const user = await prisma.adminUser.findUnique({ where: { id: admin.adminId } });
    if (!user || !user.isActive) throw HttpError.unauthorized();
    res.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }),
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
});

authRouter.post(
  '/password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = req.admin;
    if (!admin) throw HttpError.unauthorized();
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);

    const user = await prisma.adminUser.findUnique({ where: { id: admin.adminId } });
    if (!user) throw HttpError.unauthorized();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw HttpError.badRequest('Mot de passe actuel incorrect');
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });

    res.json({ data: { message: 'Mot de passe mis à jour' } });
  }),
);
