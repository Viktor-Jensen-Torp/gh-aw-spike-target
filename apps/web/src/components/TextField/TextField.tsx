import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, CircleAlert } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text shown above the input. Required for accessibility. */
  label: string;
  /** Optional link text and href shown in the label row. */
  link?: {
    label: string;
    href: string;
  };
  /** Optional hint text shown below the input when there's no error. */
  hint?: string;
  /** Optional error message shown below the input and makes it invalid. */
  error?: string;
}

/**
 * Labelled text input field with variants: optional link in label row, hint below,
 * trailing icon (or password toggle), and error state with message.
 *
 * Structure (gap 6):
 * - Label row (gap spread): label 12px $muted, optional link 12px $accent
 * - Input: height 42, padding 0 12, gap 8, radius 8, $surface, 1px $border
 *   - Trailing icon optional, 16px $faint (password field: button showing eye/eye-off)
 * - Hint or error below (12px $faint for hint, or error row with icon + text 12px $danger)
 *
 * Password field's trailing icon is a button showing/hiding the value,
 * named "Show password" / "Hide password".
 * Non-password field with error has circle-alert icon replacing the trailing icon.
 * Error replaces hint.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      link,
      hint,
      error,
      type = 'text',
      id,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    // Generate an ID if not provided for label association
    const fieldId =
      id || `text-field-${Math.random().toString(36).slice(2, 11)}`;

    // Determine if this is a password field
    const isPassword = type === 'password';

    // Determine the actual input type (show password if toggled)
    const actualType = isPassword && showPassword ? 'text' : type;

    // Determine which icon to show: only password toggle, no error icon inside field
    const showTrailingIcon = isPassword;

    // Error message ID for aria-describedby
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint && !error ? `${fieldId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {/* Label row: label and optional link */}
        <div className="flex items-center justify-between">
          <label htmlFor={fieldId} className="text-xs font-medium text-muted">
            {label}
          </label>
          {link && (
            <a
              href={link.href}
              className="text-xs font-medium text-accent hover:opacity-80"
            >
              {link.label}
            </a>
          )}
        </div>

        {/* Input container */}
        <div
          className={cn(
            // Container
            'flex items-center gap-2 rounded-lg px-3 py-0',
            // Sizing: height 42, padding 0 12 (px-3), gap 8 (gap-2)
            'h-[42px]',
            // Background and border
            'bg-surface',
            error ? 'border border-danger' : 'border border-border-strong',
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {/* Input field */}
          <input
            ref={ref}
            id={fieldId}
            type={actualType}
            disabled={disabled}
            {...(error && { 'aria-invalid': true })}
            aria-describedby={errorId || hintId}
            className={cn(
              // Layout
              'flex-1',
              // Typography: 14px, text color
              'text-sm font-normal',
              'text-text placeholder:text-faint',
              // Reset input defaults
              'bg-transparent border-0 outline-none',
              // Remove spinner from number inputs
              '[&::-webkit-outer-spin-button]:appearance-none',
              '[&::-webkit-inner-spin-button]:appearance-none',
              '[&[type=number]]:appearance-none',
              // Focus ring
              'focus-visible:ring-0',
              className,
            )}
            {...props}
          />

          {/* Trailing icon: password toggle only, eye icon same color in error state */}
          {showTrailingIcon && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="flex-shrink-0 text-faint hover:text-text hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={2} />
              ) : (
                <Eye size={16} strokeWidth={2} />
              )}
            </button>
          )}
        </div>

        {/* Hint or error message below input */}
        {error ? (
          <div id={errorId} className="flex items-start gap-1.5">
            <CircleAlert
              size={14}
              strokeWidth={2}
              className="flex-shrink-0 text-danger mt-px"
            />
            <p className="text-xs font-normal text-danger">{error}</p>
          </div>
        ) : hint ? (
          <p id={hintId} className="text-xs font-normal text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = 'TextField';
