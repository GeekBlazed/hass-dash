import React from 'react';

/**
 * Button Variants
 * - primary: Main action button (blue)
 * - secondary: Secondary action (gray)
 * - ghost: Minimal button with no background
 * - danger: Destructive action (red)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Button Sizes
 * - sm: Small button (compact)
 * - md: Medium button (default)
 * - lg: Large button (prominent)
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Loading state - disables button and shows loading indicator */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon to display before the button text */
  iconBefore?: React.ReactNode;
  /** Icon to display after the button text */
  iconAfter?: React.ReactNode;
}

/**
 * Button Component
 *
 * Accessible, styled button with multiple variants and sizes.
 * Built with Tailwind CSS for consistent styling across the app.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click Me
 * </Button>
 *
 * <Button variant="danger" size="sm" loading>
 *   Deleting...
 * </Button>
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconBefore,
  iconAfter,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps): React.ReactElement {
  // Base styles applied to all buttons
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variant styles
  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-primary text-white hover:bg-primary-dark focus:ring-primary dark:bg-primary-light dark:hover:bg-primary',
    secondary:
      'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
    ghost:
      'text-primary hover:bg-primary/10 focus:ring-primary dark:text-primary-light',
    danger:
      'bg-danger text-white hover:bg-danger-dark focus:ring-danger dark:bg-danger-light dark:hover:bg-danger',
  };

  // Size styles
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-sm px-3 py-1.5 rounded gap-1.5',
    md: 'text-base px-4 py-2 rounded-lg gap-2',
    lg: 'text-lg px-6 py-3 rounded-lg gap-2.5',
  };

  // Full width style
  const widthStyle = fullWidth ? 'w-full' : '';

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`.trim();

  return (
    <button
      className={combinedClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && iconBefore && <span aria-hidden="true">{iconBefore}</span>}
      <span>{children}</span>
      {!loading && iconAfter && <span aria-hidden="true">{iconAfter}</span>}
    </button>
  );
}
