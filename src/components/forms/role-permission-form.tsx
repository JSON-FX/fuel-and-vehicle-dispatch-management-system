'use client';

import { ShieldPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

interface PermissionOption {
  readonly publicId: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}
interface RoleValue {
  readonly publicId: string;
  readonly name: string;
  readonly isPrivileged: boolean;
  readonly isActive: boolean;
  readonly permissions: readonly string[];
}

export function RolePermissionForm({
  csrfToken,
  permissions,
  role,
  canAssignPrivileged,
}: {
  readonly csrfToken: string;
  readonly permissions: readonly PermissionOption[];
  readonly role?: RoleValue;
  readonly canAssignPrivileged: boolean;
}) {
  const router = useRouter();
  const createMode = role === undefined;
  const [open, setOpen] = useState(!createMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = createMode ? 'create-role-form' : 'edit-role-form';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const values = {
      name: form.get('name'),
      isPrivileged: form.get('isPrivileged') === 'on',
      isActive: form.get('isActive') === 'on',
      permissionPublicIds: form.getAll('permissionPublicIds'),
    };
    try {
      if (createMode) {
        const response = await fetch('/api/roles', {
          method: 'POST',
          headers: jsonHeaders(csrfToken),
          body: JSON.stringify(values),
        });
        const created = await readApiResponse<{ publicId: string }>(response);
        setOpen(false);
        router.push(`/admin/roles/${created.publicId}`);
      } else {
        const update = await fetch(`/api/roles/${role.publicId}`, {
          method: 'PATCH',
          headers: jsonHeaders(csrfToken),
          body: JSON.stringify({
            name: values.name,
            isPrivileged: values.isPrivileged,
            isActive: values.isActive,
          }),
        });
        await readApiResponse(update);
        const assignment = await fetch(`/api/roles/${role.publicId}/permissions`, {
          method: 'PUT',
          headers: jsonHeaders(csrfToken),
          body: JSON.stringify({ permissionPublicIds: values.permissionPublicIds }),
        });
        await readApiResponse(assignment);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The role could not be saved.');
    } finally {
      setPending(false);
    }
  }

  const form = (
    <form id={formId} className="space-y-5" onSubmit={submit}>
      <FormStatus message={error} />
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>Role name</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          defaultValue={role?.name}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={role?.isActive ?? true}
            className="size-5 accent-accent"
          />
          Role active
        </label>
        {canAssignPrivileged ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="isPrivileged"
              defaultChecked={role?.isPrivileged}
              className="size-5 accent-accent"
            />
            Privileged role
          </label>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Role or permission changes revoke affected user sessions.
      </p>
      <PermissionGroups permissions={permissions} assignedCodes={role?.permissions ?? []} />
    </form>
  );
  if (!createMode)
    return (
      <div>
        {form}
        <div className="mt-5">
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? 'Saving…' : 'Save role and permissions'}
          </Button>
        </div>
      </div>
    );
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <ShieldPlus aria-hidden="true" />
        Create role
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Create role</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the least set of permissions needed for this responsibility.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {form}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? 'Creating…' : 'Create role'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PermissionGroups({
  permissions,
  assignedCodes,
}: {
  readonly permissions: readonly PermissionOption[];
  readonly assignedCodes: readonly string[];
}) {
  const groups = Map.groupBy(
    permissions.filter((permission) => permission.isActive),
    (permission) => permission.code.split('.', 1)[0] ?? 'other',
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from(groups, ([domain, items]) => (
        <fieldset key={domain} className="rounded-md border p-3">
          <legend className="px-1 font-heading font-semibold capitalize">{domain}</legend>
          <div className="mt-1 space-y-1">
            {items.map((permission) => (
              <label
                key={permission.publicId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  name="permissionPublicIds"
                  value={permission.publicId}
                  defaultChecked={assignedCodes.includes(permission.code)}
                  className="size-5 accent-accent"
                />
                <span>
                  <span className="block">{permission.name}</span>
                  <code className="text-xs text-muted-foreground">{permission.code}</code>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function jsonHeaders(csrfToken: string) {
  return { 'content-type': 'application/json', 'x-csrf-token': csrfToken };
}
