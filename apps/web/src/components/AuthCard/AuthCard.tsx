import { forwardRef, type FormHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';
import { Brand } from '../Brand/Brand.tsx';
import { Button } from '../Button/Button.tsx';

interface AuthCardProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Main heading text */
  heading: string;
  /** Subheading text */
  subheading: string;
  /** The form fields to render (gap 16) */
  children: ReactNode;
  /** Submit button label */
  submitLabel: string;
  /** Footer text (first part) */
  footerText: string;
  /** Footer link text */
  footerLinkText: string;
  /** Footer link href */
  footerLinkHref: string;
  /** Called when the form is submitted */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

/**
 * The auth card: a centered container with the brand, heading, subheading,
 * form fields, submit button, and footer with a link.
 *
 * - Container: 440 px wide, padding 36, gap 24, radius 14, `$surface` background,
 *   1 px `$border` stroke, centered on the `$bg`
 * - Brand: with name, auth variant
 * - Header: heading 24 px weight 600 `$text`, subheading 14 px `$muted`, gap 6
 * - Form: fields passed in, gap 16
 * - Submit: Button primary block with the given label
 * - Footer: centred, gap 6, footer text 13 px `$muted`, link 13 px weight 600 `$accent`
 */
export const AuthCard = forwardRef<HTMLFormElement, AuthCardProps>(
  (
    {
      heading,
      subheading,
      children,
      submitLabel,
      footerText,
      footerLinkText,
      footerLinkHref,
      onSubmit,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <form
        ref={ref}
        onSubmit={onSubmit}
        className={cn(
          // Container: 440 px wide, padding 36 (p-9), gap 24 (gap-6), radius 14
          'w-[440px] p-9 gap-6 rounded-[14px]',
          // Background and border
          'bg-surface border border-border',
          // Shadow from design: offset (0, 10), blur 28, color $shadow-subtle
          'shadow-[0_10px_28px_rgba(25,25,23,0.06)]',
          // Flex column
          'flex flex-col items-center',
          className,
        )}
        {...props}
      >
        {/* Brand with name */}
        <Brand withName variant="auth" />

        {/* Header: heading and subheading */}
        <div className="w-full flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-text">{heading}</h1>
          <p className="text-sm text-muted leading-[1.5]">{subheading}</p>
        </div>

        {/* Form fields (gap 16: gap-4) */}
        <div className="w-full flex flex-col gap-4">{children}</div>

        {/* Submit button */}
        <Button type="submit" variant="primary" size="primary-block">
          {submitLabel}
        </Button>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs text-muted">{footerText}</span>
          <a
            href={footerLinkHref}
            className="text-xs font-semibold text-accent hover:opacity-80"
          >
            {footerLinkText}
          </a>
        </div>
      </form>
    );
  },
);

AuthCard.displayName = 'AuthCard';
