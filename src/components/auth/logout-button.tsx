'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { readApiResponse } from '../forms/auth-form-utils';

export function LogoutButton({ iconOnly = false }: { readonly iconOnly?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const label = pending ? 'Signing out…' : 'Sign out';

  async function logout() {
    setPending(true);
    try {
      const current = await fetch('/api/me', { cache: 'no-store' });
      const { csrfToken } = await readApiResponse<{ csrfToken: string }>(current);
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: '{}',
      });
      await readApiResponse(response);
      router.replace('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? 'icon' : 'default'}
      aria-label={label}
      title={iconOnly ? label : undefined}
      onClick={logout}
      disabled={pending}
    >
      <LogOut aria-hidden="true" />
      <span className={iconOnly ? 'sr-only' : undefined}>{label}</span>
    </Button>
  );
}
