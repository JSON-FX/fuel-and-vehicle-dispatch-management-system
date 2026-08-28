import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthenticationLayout({ children }: { readonly children: ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
          <Building2 className="size-5 text-accent" aria-hidden="true" />
          <span>Government operations system</span>
        </div>
        {children}
        <p className="text-center text-sm text-muted-foreground">
          Authorized personnel only. Activity may be recorded for security and audit purposes.
        </p>
      </div>
    </main>
  );
}
