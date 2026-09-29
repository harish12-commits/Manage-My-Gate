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

/** Types into a PhoneInput identified by its testID (placeholders follow the selected country). */
export const typePhone = async (view: View, testID: string, value: string) => {
  await fireEvent.changeText(await view.findByTestId(testID), value);
};

/** Picks a status option from a SearchFilterBar (its options live in a filter modal). */
export const chooseFilter = async (view: View, label: string | RegExp) => {
  await fireEvent.press(await view.findByLabelText('Open filter options'));
  const options = await view.findAllByText(label);
  await fireEvent.press(options[options.length - 1]);
};

const flatten = (c: any): string =>
  Array.isArray(c) ? c.map(flatten).join('') : typeof c === 'string' || typeof c === 'number' ? String(c) : '';

/** Every distinct text currently rendered — for diagnosing label/translation mismatches. */
export const visibleTexts = (view: View): string[] => [
  ...new Set(view.queryAllByText(/.+/).map((n: any) => flatten(n.props.children))),
];

/** Waits until `text` is visible, failing with whatever error banner the screen shows instead. */
export const expectVisible = async (view: View, text: string | RegExp, timeout = 15000) =>
  waitFor(() => expect(view.getByText(text)).toBeOnTheScreen(), { timeout });
