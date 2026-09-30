import * as React from 'react';
import { AppLoader } from '../../components/ui/AppLoader';

/**
 * Lazy-load a component (its module is only evaluated on first render) and wrap it in
 * a Suspense boundary that shows the theme loader. Pass `fallback={null}` for overlays
 * such as modals and sheets that should not show a spinner while loading.
 */
export function lazyComponent<P extends object>(
  factory: () => Promise<{ default: React.ComponentType<P> }>,
  fallback: React.ReactNode = <AppLoader variant="block" />,
): React.ComponentType<P> {
  const LazyInner = React.lazy(factory);
  const Wrapped = (props: P) => (
    <React.Suspense fallback={fallback}>
      <LazyInner {...(props as any)} />
    </React.Suspense>
  );
  Wrapped.displayName = 'LazyComponent';
  return Wrapped;
}
