'use client';

import type * as React from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const Sheet = Dialog;
const SheetTrigger = DialogTrigger;
const SheetClose = DialogClose;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;

function SheetContent({
  className,
  side = 'right',
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  readonly side?: 'left' | 'right';
}) {
  return (
    <DialogContent
      className={cn(
        'top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100%-3rem))] max-w-none translate-y-0 flex-col gap-0 rounded-none border-y-0 p-0',
        side === 'left'
          ? 'left-0 translate-x-0 border-l-0'
          : 'right-0 left-auto translate-x-0 border-r-0',
        className,
      )}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
