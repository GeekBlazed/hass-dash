import React, { useState } from 'react';
import { Button } from './ui/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/Dialog';

/**
 * Component Showcase
 *
 * Displays all UI components with interactive examples.
 * Feature-flagged for development use only.
 */
export function ComponentShowcase(): React.ReactElement {
  const [buttonLoading, setButtonLoading] = useState(false);

  const handleLoadingDemo = () => {
    setButtonLoading(true);
    setTimeout(() => setButtonLoading(false), 2000);
  };

  return (
    <div className="space-y-12">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Component Showcase</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Interactive examples of all UI components built with Radix UI and Tailwind CSS.
        </p>
      </div>

      {/* Button Component */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Button</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Accessible button component with multiple variants and sizes.
          </p>
        </div>

        {/* Variants */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Variants</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </div>

        {/* Sizes */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sizes</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>

        {/* States */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">States</h3>
          <div className="flex flex-wrap gap-4">
            <Button disabled>Disabled</Button>
            <Button loading={buttonLoading} onClick={handleLoadingDemo}>
              {buttonLoading ? 'Loading...' : 'Click to Load'}
            </Button>
            <Button
              iconBefore={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              With Icon
            </Button>
          </div>
        </div>

        {/* Full Width */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Full Width</h3>
          <Button fullWidth>Full Width Button</Button>
        </div>
      </section>

      {/* Dialog Component */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Dialog</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Modal dialog component built with Radix UI Dialog primitive.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Basic Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="primary">Open Basic Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Basic Dialog</DialogTitle>
                <DialogDescription>
                  This is a simple dialog with a title and description. Click the X or press
                  Escape to close.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          {/* Confirmation Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Delete Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this item? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button variant="danger">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Form Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Edit Profile</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Make changes to your profile here. Click save when you&apos;re done.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    defaultValue="John Doe"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    defaultValue="john@example.com"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button variant="primary">Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Color Palette */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Color Palette</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Theme colors configured in Tailwind CSS.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Primary */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Primary</h3>
            <div className="flex gap-2">
              <div className="h-16 w-full rounded bg-primary-light"></div>
              <div className="h-16 w-full rounded bg-primary"></div>
              <div className="h-16 w-full rounded bg-primary-dark"></div>
            </div>
          </div>

          {/* Success */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Success</h3>
            <div className="flex gap-2">
              <div className="h-16 w-full rounded bg-success-light"></div>
              <div className="h-16 w-full rounded bg-success"></div>
              <div className="h-16 w-full rounded bg-success-dark"></div>
            </div>
          </div>

          {/* Warning */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Warning</h3>
            <div className="flex gap-2">
              <div className="h-16 w-full rounded bg-warning-light"></div>
              <div className="h-16 w-full rounded bg-warning"></div>
              <div className="h-16 w-full rounded bg-warning-dark"></div>
            </div>
          </div>

          {/* Danger */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Danger</h3>
            <div className="flex gap-2">
              <div className="h-16 w-full rounded bg-danger-light"></div>
              <div className="h-16 w-full rounded bg-danger"></div>
              <div className="h-16 w-full rounded bg-danger-dark"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
