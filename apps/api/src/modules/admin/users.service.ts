import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors';

const STAFF_ROLES = ['admin', 'trainer'] as const;

export async function listStaffUsers() {
  return prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createStaffUser(data: {
  email: string;
  fullName: string;
  password: string;
  role: 'admin' | 'trainer';
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError('Un utilisateur avec cet email existe deja');

  const passwordHash = await bcrypt.hash(data.password, 12);

  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      role: data.role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
}

export async function updateStaffUser(
  id: string,
  data: { role?: 'admin' | 'trainer'; fullName?: string; resetPassword?: boolean },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilisateur');
  if (!STAFF_ROLES.includes(user.role as any)) {
    throw new BadRequestError('Seuls les comptes admin/trainer peuvent etre modifies ici');
  }

  let tempPassword: string | null = null;
  const updateData: Record<string, unknown> = {};

  if (data.role) {
    updateData.role = data.role;
  }

  if (data.fullName) {
    updateData.fullName = data.fullName;
  }

  if (data.resetPassword) {
    tempPassword = crypto.randomBytes(6).toString('base64url'); // ~8 chars
    updateData.passwordHash = await bcrypt.hash(tempPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  return { user: updated, tempPassword };
}

export async function deleteStaffUser(id: string, currentUserId: string) {
  if (id === currentUserId) {
    throw new ForbiddenError('Impossible de supprimer votre propre compte');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilisateur');
  if (!STAFF_ROLES.includes(user.role as any)) {
    throw new BadRequestError('Seuls les comptes admin/trainer peuvent etre supprimes ici');
  }

  await prisma.user.delete({ where: { id } });
}
