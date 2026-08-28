import { z } from 'zod';

export const publicIdSchema = z.string().uuid();

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(128),
});

export const passwordChangeSchema = z.object({ newPassword: z.string().min(1).max(128) });
export const totpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const reasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });

export const createUserSchema = z.object({
  username: z.string().min(1).max(100),
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(200),
  rolePublicIds: z.array(publicIdSchema).max(50),
});

export const updateUserSchema = z
  .object({
    email: z.string().email().max(254).optional(),
    fullName: z.string().trim().min(2).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field is required.',
  });

export const roleIdsSchema = z.object({
  rolePublicIds: z.array(publicIdSchema).max(50),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  isPrivileged: z.boolean().default(false),
  permissionPublicIds: z.array(publicIdSchema).max(100),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    isPrivileged: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field is required.',
  });

export const permissionIdsSchema = z.object({
  permissionPublicIds: z.array(publicIdSchema).max(100),
});
