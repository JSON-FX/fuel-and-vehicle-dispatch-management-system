'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OneTimeCredentialDialog } from '@/components/admin/one-time-credential-dialog';
import { FormStatus } from '@/components/forms/form-status';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { readApiResponse } from './auth-form-utils';

export interface RoleOption {
  readonly publicId: string;
  readonly name: string;
  readonly isPrivileged: boolean;
}

export function UserForm({
  csrfToken,
  roles,
}: {
  readonly csrfToken: string;
  readonly roles: readonly RoleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          username: form.get('username'),
          email: form.get('email'),
          fullName: form.get('fullName'),
          rolePublicIds: form.getAll('rolePublicIds'),
        }),
      });
      const result = await readApiResponse<{ temporaryPassword: string }>(response);
      setCredential(result.temporaryPassword);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The user could not be created.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        Create user
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create user</AlertDialogTitle>
            <AlertDialogDescription>
              A temporary password will appear once after creation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form id="create-user-form" className="space-y-4" onSubmit={submit}>
            <FormStatus message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-username">Username</Label>
                <Input id="create-username" name="username" autoComplete="off" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input id="create-email" name="email" type="email" autoComplete="off" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-full-name">Full name</Label>
                <Input id="create-full-name" name="fullName" autoComplete="off" required />
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold">Roles</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {roles.map((role) => (
                  <label
                    key={role.publicId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="rolePublicIds"
                      value={role.publicId}
                      className="size-5 accent-accent"
                    />
                    {role.name}
                    {role.isPrivileged ? ' (privileged)' : ''}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="submit" form="create-user-form" disabled={pending}>
              {pending ? 'Creating…' : 'Create user'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OneTimeCredentialDialog credential={credential} onClose={() => setCredential(null)} />
    </>
  );
}

export function UserRoleForm({
  userId,
  csrfToken,
  roles,
  assignedRoleCodes,
}: {
  readonly userId: string;
  readonly csrfToken: string;
  readonly roles: readonly (RoleOption & { readonly code: string })[];
  readonly assignedRoleCodes: readonly string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ rolePublicIds: form.getAll('rolePublicIds') }),
      });
      await readApiResponse(response);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Roles could not be updated.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormStatus message={error} />
      <fieldset>
        <legend className="font-heading text-lg font-semibold">Assigned roles</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.publicId}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm"
            >
              <input
                type="checkbox"
                name="rolePublicIds"
                value={role.publicId}
                defaultChecked={assignedRoleCodes.includes(role.code)}
                className="size-5 accent-accent"
              />
              {role.name}
              {role.isPrivileged ? ' (privileged)' : ''}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving roles…' : 'Save role assignments'}
      </Button>
    </form>
  );
}

export function UserIdentityForm({
  user,
  csrfToken,
}: {
  readonly user: {
    readonly publicId: string;
    readonly email: string;
    readonly fullName: string;
    readonly isActive: boolean;
  };
  readonly csrfToken: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${user.publicId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          email: form.get('email'),
          fullName: form.get('fullName'),
          isActive: form.get('isActive') === 'on',
        }),
      });
      await readApiResponse(response);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The user could not be updated.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormStatus message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-full-name">Full name</Label>
          <Input id="edit-full-name" name="fullName" defaultValue={user.fullName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input id="edit-email" name="email" type="email" defaultValue={user.email} required />
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={user.isActive}
          className="size-5 accent-accent"
        />
        Account active
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save account details'}
      </Button>
    </form>
  );
}
