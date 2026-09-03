'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ResponsiveDialog = DialogPrimitive.Root;
export const ResponsiveDialogTrigger = DialogPrimitive.Trigger;
export const ResponsiveDialogPortal = DialogPrimitive.Portal;
export const ResponsiveDialogClose = DialogPrimitive.Close;

export const ResponsiveDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
ResponsiveDialogOverlay.displayName = 'ResponsiveDialogOverlay';

interface ResponsiveDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  maxWidthClass?: string;
}

export const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ResponsiveDialogContentProps
>(({ className, children, maxWidthClass = 'sm:max-w-lg', ...props }, ref) => (
  <ResponsiveDialogPortal>
    <ResponsiveDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 flex flex-col w-[95vw] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border bg-background shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        maxWidthClass,
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </ResponsiveDialogPortal>
));
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

export const ResponsiveDialogHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'relative flex items-center justify-between border-b px-5 py-4 shrink-0 bg-background/95 backdrop-blur',
      className
    )}
    {...props}
  >
    <div className="flex-1 pr-6">{children}</div>
    <DialogPrimitive.Close className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-target flex items-center justify-center">
      <X className="h-5 w-5" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  </div>
);
ResponsiveDialogHeader.displayName = 'ResponsiveDialogHeader';

export const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base sm:text-lg font-semibold tracking-tight text-foreground', className)}
    {...props}
  />
));
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle';

export const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs sm:text-sm text-muted-foreground mt-0.5', className)}
    {...props}
  />
));
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription';

export const ResponsiveDialogBody = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex-1 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain', className)}
    {...props}
  >
    {children}
  </div>
);
ResponsiveDialogBody.displayName = 'ResponsiveDialogBody';

export const ResponsiveDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 border-t px-5 py-3.5 bg-muted/20 shrink-0 safe-bottom',
      className
    )}
    {...props}
  />
);
ResponsiveDialogFooter.displayName = 'ResponsiveDialogFooter';
