'use client';

import React from 'react';
import { COLORS, SPACING, BORDER_RADIUS } from '@/lib/design-tokens';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: COLORS.darkButton,
          color: COLORS.offWhite,
          hover: '#0F0F0F',
        };
      case 'secondary':
        return {
          background: COLORS.lightButtonBg,
          color: COLORS.deepNavy,
          hover: COLORS.lightGray,
        };
      case 'tertiary':
        return {
          background: 'transparent',
          color: COLORS.deepNavy,
          hover: COLORS.lightButtonBg,
        };
      case 'minimal':
        return {
          background: COLORS.lightGray,
          color: COLORS.deepNavy,
          hover: '#D4D6DA',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: `${SPACING.sm} ${SPACING.md}`,
          fontSize: '14px',
          height: '32px',
          borderRadius: BORDER_RADIUS.md,
        };
      case 'md':
        return {
          padding: `${SPACING.sm} ${SPACING.base}`,
          fontSize: '14px',
          height: '40px',
          borderRadius: BORDER_RADIUS.full,
        };
      case 'lg':
        return {
          padding: `${SPACING.sm} ${SPACING.base}`,
          fontSize: '16px',
          height: '40px',
          borderRadius: BORDER_RADIUS.full,
        };
      default:
        return {};
    }
  };

  const styles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      style={{
        backgroundColor: styles.background,
        color: styles.color,
        ...sizeStyles,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-primary)',
        fontWeight: variant === 'primary' ? 400 : 400,
        border: 'none',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: 'all 0.2s ease',
        ...props.style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            styles.hover || styles.background;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          styles.background || COLORS.darkButton;
      }}
    >
      {isLoading ? (
        <>
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              marginRight: SPACING.sm,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          Loading...
        </>
      ) : (
        children
      )}
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}
