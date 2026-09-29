# Final Mobile UI Keyboard + Input Alignment Verification

Date: 2026-09-28
Scope: NAHOM React Native mobile application

## Executive result

The code-level audit found and fixed two global keyboard/input defects and one specialized phone-input alignment gap. TypeScript, the complete Jest suite, and the Android release build pass. This report does not claim physical-device visual verification; the runtime matrix at the end remains required before production upload.

## 1. Keyboard architecture verified

- Android activity uses `android:windowSoftInputMode="adjustResize"`.
- iOS keyboard-aware containers use automatic keyboard insets and padding behavior.
- Shared forms use `KeyboardAwareScrollView` / `KeyboardAvoidingShell` with handled taps and drag dismissal.
- The previous implementation always scrolled to a fixed `top - 60` location, even when the focused field was already visible. This could cause unnecessary movement and inconsistent positioning on different screens.
- The shared scroller now delegates visibility measurement to React Native's `scrollResponderScrollNativeHandleToKeyboard`, using only the configured extra clearance.
- The keyboard spacer is now a real trailing element. Caller-provided `contentContainerStyle.paddingBottom` can no longer override the space needed to reach the final field.
- The layout-triggered scroll callback was removed to prevent repeated or progressive shifting during keyboard/layout changes.

## 2. TextInput components audited

The code search found 216 `TextInput`/`RNTextInput` JSX occurrences across `app`, `components`, and `src`, excluding tests. The reusable input surface was audited first, followed by raw/specialized OTP, PIN, search, phone, modal, wizard, complaint, amenity, billing, profile, organization, visitor, and integration input call sites.

Primary reusable components reviewed:

- `components/forms/TextInput.tsx`
- `components/ui/input.tsx`
- `components/forms/PasswordInput.tsx`
- `components/forms/PhoneInput.tsx`
- `components/forms/SearchBar.tsx`
- `components/forms/PinCodeInput.tsx`
- `components/auth/OtpInputField.tsx`
- `components/forms/DropdownSelect.tsx`

## 3. Input internal alignment verified

Both general-purpose input primitives already defined Android-safe font padding and single-line/multiline vertical alignment. However, caller props were spread after the composed `style`, so any caller-provided style replaced the complete composed style array. This particularly affected multiline inputs that supplied custom minimum heights.

The prop ordering is now corrected. Caller sizing is retained inside the composed style array, while the reusable component's alignment defaults are no longer discarded accidentally.

## 4. Single-line input alignment

- Default: `textAlignVertical: 'center'`.
- Android font padding: `includeFontPadding: false`.
- Consistent horizontal padding remains in the shared input container/input.
- Phone number input now explicitly applies centered vertical alignment and disables Android font padding.
- Search input already applies centered vertical alignment and disabled font padding.

## 5. Multiline input alignment

- Default: `textAlignVertical: 'top'`.
- Multiline fields retain their caller-defined `minHeight`/height styles through style composition.
- Multiline fields are not forced into the single-line centering rule.

## 6. Cursor alignment

Code-level defaults now keep cursor and text on the same vertical alignment path for normal, password, phone, search, numeric, and multiline inputs. Exact cursor rendering still requires physical Android OEM/device verification because font rasterization and keyboard implementations are native/runtime behavior.

## 7. Placeholder alignment

Placeholder and entered text use the same native input layout and composed style. Custom `placeholderTextColor` remains supported. Physical-device visual comparison is still required.

## 8. Icon alignment

- Shared input wrappers use row alignment and centered icon containers.
- Left and right accessory spacing prevents overlap with entered text.
- Password eye actions remain in a dedicated touch target.
- The alternate reusable `Input` password toggle now explicitly applies its secure-text state; previously the eye state changed but was not guaranteed to update `secureTextEntry`.

## 9. Button text alignment

Reusable button implementations were reviewed. They use centered row layouts, minimum heights, horizontal padding, icon gaps, single-line labels, and font-size reduction support for constrained widths. No global button change was required in this pass. Labels such as Previous, Save Draft, Continue, Cancel, Save, Submit, Update, Invite User, Create Amenity, and Next still require runtime checks with real translations and font scaling.

## 10. Header alignment

Reusable mobile and flow headers were reviewed for row centering, flexible title space, shrinking action regions, and truncation behavior. No confirmed code-level header defect required a change. Long-title behavior and accessibility font scaling must be checked on small devices.

## 11. Bottom-sheet/modal keyboard behavior

- The shared UI bottom sheet uses the keyboard-aware scroller.
- Major form screens and key modal flows use keyboard-aware containers or scroll views with `keyboardShouldPersistTaps="handled"`.
- The global scroller fix applies to Invite User, assessment creation, login, complaint creation, and other consumers.
- Feature-specific sheets using plain scroll containers must still be exercised on-device; static analysis cannot prove native bottom-sheet movement, keyboard animation, focus retention, or OEM-specific behavior.

## 12. Small-screen responsiveness

Code-level checks confirm flex/min-width patterns, scrollable form surfaces, trailing keyboard clearance, and Android `adjustResize`. The fixed-scroll offset was removed, eliminating a screen-size-dependent positioning rule. Runtime tests remain required at approximately 320–360 dp width and with increased system font/display scale.

## 13. Files changed in this audit

- `components/layout/KeyboardAwareScrollView.tsx`
- `components/forms/TextInput.tsx`
- `components/ui/input.tsx`
- `components/forms/PhoneInput.tsx`
- `mobile_ui_keyboard_input_alignment_final_report.md`

No API, authentication, authorization, invitation, organization/villa/role switching, booking, payment, wallet, invoice, QR, or notification business logic was changed.

## 14. TypeScript result

Command: `npx tsc --noEmit`

Result: PASS (exit code 0).

## 15. Jest result

Command: `npm test -- --runInBand`

Result: PASS.

- Test suites: 44 passed / 44 total
- Tests: 707 passed / 707 total
- Snapshots: 0

Existing expected console warnings/logs appeared in payment and issue-report tests, but no test failed.

## 16. Android release validation

Command: `android\\gradlew.bat :app:assembleRelease --console=plain`

Result: PASS (exit code 0).

Generated artifacts:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Gradle emitted a non-fatal warning that `NODE_ENV` was not specified and used `.env.local` / `.env`. For the final production signing/build workflow, set `NODE_ENV=production` explicitly.

## 17. Remaining risks

- Static analysis, TypeScript, Jest, and release compilation do not prove visual keyboard behavior.
- OEM keyboards, gesture navigation, display scaling, accessibility font scaling, safe areas, and Android versions can change viewport behavior.
- Screens with feature-specific raw inputs or plain modal scroll containers may behave differently from shared primitives.
- Translation expansion may expose button/header clipping not visible in English.
- Hardware keyboard, predictive text, password manager overlays, autofill, and one-time-code overlays require runtime testing.

## 18. Exact device/runtime tests required before production

Run on at least one small Android device/emulator (320–360 dp width) and one modern larger Android device, preferably across Android 10/11 and Android 14/15:

1. Test login, signup, forgot password, OTP, profile, Invite/Add/Edit User, amenity creation, operating schedule, amenity booking, complaint, maintenance, billing/payment, and all search/filter modals.
2. Exercise email, password, numeric, phone, default text, search, OTP, and multiline keyboards.
3. On every form, focus the first, middle, and final input; confirm the field, cursor, placeholder, and validation message remain visible.
4. Move focus between inputs while the keyboard remains open.
5. Open and close the keyboard at least five times and confirm there is no cumulative shift or flicker.
6. Scroll to and edit the last field, then dismiss the keyboard and confirm the original layout returns.
7. Verify bottom sheets return to the correct snap/position after keyboard dismissal.
8. Verify password eye toggles preserve text and cursor position.
9. Verify icon/text alignment for search, phone, dropdown, clear, validation, and password actions.
10. Verify Previous, Save Draft, Continue, Cancel, Save, Submit, Update, Invite User, Create Amenity, and Next at default and large font scale.
11. Verify long headers including Create Amenity, Operating Schedule, Invite User, Booking Details, Complaint Details, and Maintenance Request.
12. Repeat key flows with gesture navigation, three-button navigation, landscape where supported, and at 1.3x–1.5x font/display scale.

Production readiness conclusion: code/build checks are green; complete the runtime matrix above on the generated release artifact before uploading the AAB.