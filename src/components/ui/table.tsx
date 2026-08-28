import type * as React from 'react';

import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}
function TableHeader(props: React.ComponentProps<'thead'>) {
  return <thead {...props} />;
}
function TableBody(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b last:border-0', className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('h-11 bg-muted px-3 text-left font-semibold', className)} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('h-11 px-3 py-2 align-middle', className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
