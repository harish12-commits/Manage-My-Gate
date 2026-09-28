import React from 'react';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react-native';
import { PortalHost } from '@rn-primitives/portal';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { I18nProvider } from '@/src/utils/i18n';
import { store } from '@/src/store/store';

/** Renders a screen inside the same provider tree as app/_layout.tsx, with the real store. */
export const renderScreen = async (ui: React.ReactElement) =>
  render(
    <Provider store={store}>
      <I18nProvider>
        <BottomSheetModalProvider>
          {ui}
          <PortalHost />
        </BottomSheetModalProvider>
      </I18nProvider>
    </Provider>
  );

export const nav = () => (globalThis as any).__e2eNav as {
  params: Record<string, any>;
  calls: { method: string; args: any[] }[];
  redirects: any[];
};
