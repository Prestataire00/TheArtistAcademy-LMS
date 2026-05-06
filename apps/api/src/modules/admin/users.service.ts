import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../shared/errors';

const STAFF_ROLES: readonly UserRole[] = ['admin', 'trainer'] as const;

function hasAnyStaffRole(roles: UserRole[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

export async function listStaffUsers() {
  return prisma.user.findMany({
    where: { roles: { hasSome: [...STAFF_ROLES] } },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
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
  roles: UserRole[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError('Un utilisateur avec cet email existe deja');

  const passwordHash = await bcrypt.hash(data.password, 12);

  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      roles: data.roles,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
}

export async function updateStaffUser(
  id: string,
  data: { roles?: UserRole[]; fullName?: string; resetPassword?: boolean },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilisateur');
  if (!hasAnyStaffRole(user.roles)) {
    throw new BadRequestError('Seuls les comptes admin/trainer peuvent etre modifies ici');
  }

  let tempPassword: string | null = null;
  const updateData: Record<string, unknown> = {};

  if (data.roles) {
    updateData.roles = data.roles;
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
      roles: true,
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
  if (!hasAnyStaffRole(user.roles)) {
    throw new BadRequestError('Seuls les comptes admin/trainer peuvent etre supprimes ici');
  }

  await prisma.user.delete({ where: { id } });
}
