import React from 'react';
import { AppLoader } from '../ui/AppLoader';

export interface ProgressLoaderProps {
  label?: string;
  message?: string;
  /** @deprecated kept for API compatibility; size and colour come from the app theme */
  size?: 'small' | 'large';
  /** @deprecated kept for API compatibility; colour comes from the app theme */
  color?: string;
  className?: string;
}

/** Theme-aware loader; thin wrapper over AppLoader so existing call sites keep working. */
export const ProgressLoader = ({ label, message, size, className }: ProgressLoaderProps) => (
  <AppLoader
    variant={size === 'small' ? 'inline' : 'block'}
    label={label || message}
    className={className}
  />
);
