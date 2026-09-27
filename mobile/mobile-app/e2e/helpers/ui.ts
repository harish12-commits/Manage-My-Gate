import { fireEvent, waitFor } from '@testing-library/react-native';

type View = Awaited<ReturnType<typeof import('./render').renderScreen>>;

/** Presses the element showing `text` (the press bubbles to its nearest pressable ancestor). */
export const tap = async (view: View, text: string | RegExp) => {
  await fireEvent.press(await view.findByText(text));
};

/** Types into the input identified by its placeholder. */
export const typeInto = async (view: View, placeholder: string | RegExp, value: string) => {
  await fireEvent.changeText(await view.findByPlaceholderText(placeholder), value);
};

/** Waits until `text` is visible, failing with whatever error banner the screen shows instead. */
export const expectVisible = async (view: View, text: string | RegExp, timeout = 15000) =>
  waitFor(() => expect(view.getByText(text)).toBeOnTheScreen(), { timeout });
