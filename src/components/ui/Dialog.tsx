import * as DialogPrimitive from '@radix-ui/react-dialog';
import React from 'react';

// Keep dialogs above essentially all other UI.
const DIALOG_Z_INDEX = 2147483000;

/**
 * Dialog Root - Main container for dialog state
 */
export const Dialog = DialogPrimitive.Root;

/**
 * Dialog Trigger - Button that opens the dialog
 */
export const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Dialog Portal - Renders dialog in a portal
 */
export const DialogPortal = DialogPrimitive.Portal;

/**
 * Dialog Close - Button to close the dialog
 */
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog Overlay - Semi-transparent backdrop
 */
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out pointer-events-auto fixed inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/40 ${className}`}
    style={{ zIndex: DIALOG_Z_INDEX, ...props.style }}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

/**
 * Dialog Content - Main dialog container with animations
 */
type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
  showCloseButton?: boolean;
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className = '', overlayClassName = '', showCloseButton = true, children, ...props }, ref) => (
  <DialogPortal>
    <div
      className={`data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out pointer-events-auto fixed inset-0 flex items-center justify-center overflow-hidden bg-black/40 p-4 backdrop-blur-sm dark:bg-black/40 ${overlayClassName}`}
      style={{ zIndex: DIALOG_Z_INDEX }}
    >
      <DialogPrimitive.Content
        ref={ref}
        className={`data-[state=open]:animate-slide-in data-[state=closed]:animate-slide-out relative w-full max-w-lg gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-lg duration-200 sm:rounded-lg dark:border-gray-700 dark:bg-gray-800 ${className}`}
        style={{ zIndex: DIALOG_Z_INDEX + 10, ...props.style }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="focus:ring-primary absolute top-4 right-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none dark:ring-offset-gray-800"
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

/**
 * Dialog Header - Container for title and description
 */
export function DialogHeader({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
  );
}

/**
 * Dialog Footer - Container for action buttons
 */
export function DialogFooter({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${className}`}
      {...props}
    />
  );
}

/**
 * Dialog Title - Accessible title for the dialog
 */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`text-lg leading-none font-semibold tracking-tight text-gray-900 dark:text-white ${className}`}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

/**
 * Dialog Description - Accessible description for the dialog
 */
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

/**
 * Example Usage:
 *
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirm Action</DialogTitle>
 *       <DialogDescription>
 *         Are you sure you want to proceed?
 *       </DialogDescription>
 *     </DialogHeader>
 *     <DialogFooter>
 *       <DialogClose asChild>
 *         <Button variant="secondary">Cancel</Button>
 *       </DialogClose>
 *       <Button variant="primary">Confirm</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
