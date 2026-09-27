# Mobile Reusable Component Catalog

> **AUTHORITATIVE CATALOG FOR DEVELOPERS & AI AGENTS**  
> **Target Folder**: `mobile/mobile-app/components/`  
> **Total Cataloged Components**: 118 Components across 12 Categories  
> **Mandate**: ALL developers and AI agents (Antigravity, Cursor, Windsurf, Copilot, etc.) MUST strictly reuse these components when building mobile views and screens. Inline re-creation of UI primitives is strictly forbidden.

---

## Quick Navigation & Category Overview

| Category Directory | Count | Key Purpose & Responsibilities | Import Path Alias & Barrel Export |
| :--- | :---: | :--- | :--- |
| **`components/ui/`** | 24 | Atomic UI primitives, list cards, status badges, screen shells | `@/components/ui` or `@/components` |
| **`components/common/`** | 25 | Generic reusable components (Buttons, Avatars, Modals, Pickers) | `@/components/common` or `@/components` |
| **`components/forms/`** | 10 | Form input fields, selects, sliders, toggles, OTP inputs | `@/components/forms` or `@/components` |
| **`components/feedback/`** | 7 | Action sheets, empty states, error banners, loader skeletons | `@/components/feedback` or `@/components` |
| **`components/layout/`** | 8 | Safe area wrappers, keyboard avoiding shells, grid rows, spacers | `@/components/layout` or `@/components` |
| **`components/navigation/`** | 6 | Headers, context switchers (Org, Villa, Role, Profile modals) | `@/components/navigation` or `@/components` |
| **`components/hardware/`** | 6 | Device hardware integration UI (QR Scanner, NFC, Printer, Torch) | `@/components/hardware` or `@/components` |
| **`components/data/`** | 8 | Data visualization grids, audit timelines, virtualized lists | `@/components/data` or `@/components` |
| **`components/dashboard/`** | 8 | Hero banners, action tiles, customizable deck zones, quick grids | `@/components/dashboard` or `@/components` |
| **`components/auth/`** | 5 | Biometric login buttons, password strength meters, OTP inputs | `@/components/auth` or `@/components` |
| **`components/analytics/`** | 4 | Real-time metric charts, heatmaps, conversion funnel views | `@/components/analytics` or `@/components` |
| **`components/settings/`** | 7 | Theme toggles, language pickers, diagnostic viewers, storage | `@/components/settings` or `@/components` |

---

## Architecture & Styling Rules

1. **Barrel Exports**: Every component folder contains an `index.ts` barrel export file. You can import components individually, by category (`@/components/ui`), or centrally from the root (`@/components`).
2. **RTL & Logical Spacing**: ALL components enforce NativeWind logical spacing utility classes (`me-`, `ms-`, `pe-`, `ps-`, `text-start`) instead of directional physical classes (`mr-`, `ml-`, `pr-`, `pl-`) to ensure seamless Arabic/English RTL/LTR support.
3. **NativeWind Theme Tokens**: Components use theme design tokens (`bg-card`, `bg-muted`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-destructive`, `status.*`) rather than hardcoded slate colors (`bg-slate-50`, `text-slate-900`) for complete Light and Dark Mode compatibility.
4. **Strict Reuse Mandate**: Components must build upon existing primitives (`SkeletonLoader` wraps `Skeleton`, `ConfirmationModal` reuses `Button`). Inline duplicated primitives are prohibited.
5. **Dashboard Recent Activity 3-Item Limit**: Dashboard screens MUST only render a 3-item snippet (`.slice(0, 3)`) in their Recent Activity / Feed section. Never render full datasets on dashboard screens.
6. **Scroll Containment & FAB Clearance**: Outer `<ScrollView>` containers on screens with a `<FAB>` MUST include bottom inset padding (minimum `pb-28` or `paddingBottom: 110`) in `contentContainerClassName`/`contentContainerStyle` to prevent items from scrolling beyond the viewport or getting obscured by the floating action button.

---

## 1. UI Primitives (`components/ui/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`ScreenShell`** | `ScreenShell.tsx` | Standard outer screen wrapper. Includes back button, title, subtitle, loading state, error banner, retry trigger, and headerRight slots. |
| **`StatusBadge`** | `StatusBadge.tsx` | Status pill component. Accepts `variant` (`success`, `warning`, `danger`, `info`, `neutral`, `critical`) and optional pulsing `dot`. |
| **`ListCard`** | `ListCard.tsx` | Card container for items in list screens. Supports title, subtitle, icon, status badge, action buttons, and touch handlers. |
| **`PaginatedList`** | `PaginatedList.tsx` | High-performance list renderer with built-in pull-to-refresh, pagination, and empty state support. |
| **`QRCodeView`** | `QRCodeView.tsx` | Standard-compliant vector SVG QR Code matrix encoder and presentation view. Accepts `value`, `size`, and `caption`. |
| **`KPICard`** | `KPICard.tsx` | Card displaying key performance indicators, numbers, trend arrows, and icon highlights. |
| **`KPIRow`** | `KPIRow.tsx` | Horizontally aligned row container for grouping multiple KPICards. |
| **`DetailSection`** | `DetailSection.tsx` | Card or container grouping detailed key-value metadata rows. |
| **`DetailRow`** | `DetailRow.tsx` | Label and value key-pair display row with copy action support. |
| **`ActionBar`** | `ActionBar.tsx` | Sticky or floating bottom bar for primary CTA buttons (e.g. Approve/Reject, Save/Cancel). |
| **`AttachmentPicker`**| `AttachmentPicker.tsx` | File/image attachment selector supporting gallery, camera, and document picker. |
| **`BottomSheet`** | `BottomSheet.tsx` | Native bottom sheet modal container for contextual popups and action menus. |
| **`ConfirmationModal`**| `ConfirmationModal.tsx` | Modal dialog for critical confirmation flows. Accepts `visible`, `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (`danger`, `warning`, `info`), `onConfirm`, `onCancel`, and `loading`. |
| **`DateRangePicker`** | `DateRangePicker.tsx` | Calendar selector for selecting start and end date ranges. |
| **`FAB`** | `FAB.tsx` | Floating Action Button for primary screen actions. |
| **`FeatureIcon`** | `FeatureIcon.tsx` | Icon container wrapper with background colors matching feature domains. |
| **`SearchFilterBar`** | `SearchFilterBar.tsx` | Search bar combined with filter chip toggles and modal triggers. |
| **`Skeleton`** | `Skeleton.tsx` | Skeleton loading placeholder matching list items, cards, and text rows. |
| **`TabBar`** | `TabBar.tsx` | Segmented horizontal tab selection bar. |
| **`TimelineItem`** | `TimelineItem.tsx` | Vertical audit trail or process timeline item component. |
| **`button`** | `button.tsx` | Primitive button variant wrapper supporting CVA variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`, `loading`). |
| **`icon`** | `icon.tsx` | Primitive Lucide icon wrapper with size and color styling properties. |
| **`input`** | `input.tsx` | Primitive input field wrapper. |
| **`text`** | `text.tsx` | Primitive typography wrapper handling theme color and text variants. |

---

## 2. Common Components (`components/common/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`Button`** | `Button.tsx` | Standard interactive button with primary, secondary, outline, and destructive variants. |
| **`Badge`** | `Badge.tsx` | *(Deprecated)* General purpose tag/badge indicator that delegates to canonical `StatusBadge`. |
| **`Avatar`** | `Avatar.tsx` | User profile avatar with initials fallback and online status indicator. |
| **`Card`** | `Card.tsx` | Elevated container box with `CardHeader`, `CardContent`, and `CardFooter` sub-components using theme tokens (`bg-card`, `border-border`). |
| **`Chip`** | `Chip.tsx` | Interactive filter chip or tag pill with dismiss/check actions. |
| **`ConfirmationDialog`**| `ConfirmationDialog.tsx` | Reusable popup modal for quick confirm/cancel prompts. |
| **`DatePicker`** | `DatePicker.tsx` | Single date selection input modal. |
| **`TimePicker`** | `TimePicker.tsx` | Time picker input modal (12h/24h formats). |
| **`Calendar`** | `Calendar.tsx` | Month view calendar for selecting dates. |
| **`Divider`** | `Divider.tsx` | Visual separator line (horizontal or vertical). |
| **`IconButton`** | `IconButton.tsx` | Circular or square icon button delegating to canonical `<Button size="icon">`. |
| **`ImageCarousel`** | `ImageCarousel.tsx` | Swipeable image gallery carousel with pagination dots. |
| **`ImagePreview`** | `ImagePreview.tsx` | Full-screen image preview overlay with zoom support. |
| **`ListItem`** | `ListItem.tsx` | Standard list row with left icon, title, subtitle, and right accessory/chevron. |
| **`Modal`** | `Modal.tsx` | Generic full screen or popup modal overlay. |
| **`Pagination`** | `Pagination.tsx` | Page numbers and prev/next controls for tables and lists. |
| **`ProgressBar`** | `ProgressBar.tsx` | Linear progress bar with percentage indicator. |
| **`PullToRefresh`** | `PullToRefresh.tsx` | Refresh control wrapper for scroll views. |
| **`QuantitySelector`** | `QuantitySelector.tsx` | Incremental (+ / -) count selector for tickets or items. |
| **`Rating`** | `Rating.tsx` | Star rating display and interactive rating selector. |
| **`SectionHeader`** | `SectionHeader.tsx` | Section title header with optional "See All" action button. |
| **`SegmentedControl`** | `SegmentedControl.tsx` | iOS/Android style dual/triple option toggle switch. |
| **`SwipeableRow`** | `SwipeableRow.tsx` | List row supporting left/right swipe action triggers (e.g. Delete, Edit). |
| **`Tabs`** | `Tabs.tsx` | Multi-tab view container. |
| **`CommonBottomSheet`** | `BottomSheet.tsx` | Common bottom sheet modal popup. |

---

## 3. Form Input Controls (`components/forms/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`TextInput`** | `TextInput.tsx` | Labelled text input field. Supports `label`, `error`, `helperText`, `required`, `loading`, `leftIcon`, `rightIcon`, `onRightIconPress`, and active focus ring highlighting. |
| **`PasswordInput`** | `PasswordInput.tsx` | Secure text field with visibility toggle eye icon. |
| **`DropdownSelect`**| `DropdownSelect.tsx` | Single/multi select picker modal with search filtering. |
| **`FileUploadField`**| `FileUploadField.tsx` | File uploader box with progress bar and thumbnail preview. |
| **`PinCodeInput`** | `PinCodeInput.tsx` | 4 or 6 digit PIN passcode entry box. |
| **`RadioGroup`** | `RadioGroup.tsx` | Single choice radio selection option group. |
| **`Checkbox`** | `Checkbox.tsx` | Checkbox form input with label and helper text. |
| **`ToggleSwitch`** | `ToggleSwitch.tsx` | On/Off boolean toggle switch with smooth animation. |
| **`SliderInput`** | `SliderInput.tsx` | Range slider control for numeric values. |
| **`DayOfMonthPicker`**| `DayOfMonthPicker.tsx` | Reusable day-of-month selector with configurable maxDay range (e.g. 28) and quick pick grid. |
| **`SearchBar`** | `SearchBar.tsx` | Standalone search input box with clear button. |

---

## 4. Feedback & Status Overlay (`components/feedback/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`EmptyState`** | `EmptyState.tsx` | Illustrated placeholder when data lists or searches return 0 records. Supports optional `icon` (defaults to `Inbox`), `title`, `description`, `actionLabel`, and `onAction`. |
| **`ErrorBanner`** | `ErrorBanner.tsx` | Warning/Error alert notification banner with `title`, `message`, `onRetry`, `retryLabel`, and `onDismiss` slots. |
| **`SuccessToast`** | `SuccessToast.tsx` | Toast alert notification for completed actions. |
| **`ActionSheet`** | `ActionSheet.tsx` | Bottom action list picker sheet. |
| **`OfflineBanner`** | `OfflineBanner.tsx` | Network connectivity offline notification bar. |
| **`ProgressLoader`** | `ProgressLoader.tsx` | Spinner loader with message text. |
| **`SkeletonLoader`** | `SkeletonLoader.tsx` | Skeleton placeholder loader built on top of Skeleton UI primitive. |

---

## 5. Layout & Shell Helpers (`components/layout/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`SafeAreaWrapper`**| `SafeAreaWrapper.tsx` | Wraps screens to avoid status bar and gesture navigation bars. |
| **`KeyboardAvoidingShell`**| `KeyboardAvoidingShell.tsx` | Prevents input fields from being covered by on-screen software keyboards. |
| **`ScrollContainer`**| `ScrollContainer.tsx` | Scrollable container with padding and pull-to-refresh integration. |
| **`Typography`** | `Typography.tsx` | Standardized headings, body text, subtext, and caption elements. |
| **`GridRow`** | `GridRow.tsx` | Flexbox row layout container. |
| **`Spacer`** | `Spacer.tsx` | Vertical or horizontal spacing element. |
| **`SectionDivider`**| `SectionDivider.tsx` | Styled divider for separating content sections. |
| **`AbsoluteOverlay`**| `AbsoluteOverlay.tsx` | Full-bleed absolute overlay backdrop for modal views. |

---

## 6. App Navigation & Context Switching (`components/navigation/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`MobileHeader`** | `MobileHeader.tsx` | Main application top bar with tenant logo, search trigger, and notifications. |
| **`OrgSwitchModal`**| `OrgSwitchModal.tsx` | Modal pop-up to switch current organization context. |
| **`VillaSwitchModal`**| `VillaSwitchModal.tsx` | Modal pop-up to switch active villa or unit context. |
| **`RoleSwitchModal`**| `RoleSwitchModal.tsx` | Modal pop-up to switch active user role (e.g. Resident -> Guard -> Admin). |
| **`ProfileModal`** | `ProfileModal.tsx` | User profile avatar menu modal. |
| **`NotificationSheetModal`**| `NotificationSheetModal.tsx` | Slide-up notifications list drawer. |

---

## 7. Device Hardware Integrations (`components/hardware/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`QRScannerOverlay`**| `QRScannerOverlay.tsx` | Camera viewfinder overlay for scanning visitor QR passes. |
| **`QRScannerModal`**  | `QRScannerModal.tsx`   | Standard hardware camera scanner modal with overlay, torch toggle, and manual input. Accepts `visible`, `onClose`, `onScanCode`, `title`, `instruction`. |
| **`NFCScanIndicator`**| `NFCScanIndicator.tsx` | Animated ripple indicator for scanning NFC guard patrol tags. |
| **`PrinterStatusBadge`**| `PrinterStatusBadge.tsx` | Thermal receipt printer connection status badge. |
| **`FlashlightToggle`**| `FlashlightToggle.tsx` | Camera flash / torch toggle button. |
| **`ConceptualImageReference`**| `ConceptualImageReference.tsx` | Image capture reference placeholder for guard inspection photos. |

---

## 8. Data Visualization & Tracking (`components/data/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`OptimizedDataGrid`**| `OptimizedDataGrid.tsx` | High-performance grid table for tabular records. |
| **`VirtualizedList`**| `VirtualizedList.tsx` | Virtualized list renderer for extra large datasets. |
| **`MetricCard`** | `MetricCard.tsx` | Metric summary card with progress rings and subtext. |
| **`ExpandableCardList`**| `ExpandableCardList.tsx` | Accordion-style list item with collapsible detail view. |
| **`AuditTrailTimeline`**| `AuditTrailTimeline.tsx` | Chronological audit log timeline tree view. |
| **`AgenticStateTracker`**| `AgenticStateTracker.tsx` | State tracker component for AI background processing states. |
| **`RawPayrollTable`**| `RawPayrollTable.tsx` | Staff salary and payroll table layout. |
| **`WorkflowTriggerLog`**| `WorkflowTriggerLog.tsx` | Automated workflow execution log entry display. |

---

## 9. Dashboard Components (`components/dashboard/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`HeroBanner`** | `HeroBanner.tsx` | Top feature banner card with call to action. |
| **`QuickActionsGrid`**| `QuickActionsGrid.tsx` | 2x4 or 3x3 shortcut grid for frequent actions (Add Visitor, Book Slot, Pay Bill). |
| **`QuickActionsAllModal`**| `QuickActionsAllModal.tsx` | Full screen drawer listing all available feature shortcuts. |
| **`ActionTile`** | `ActionTile.tsx` | Action tile item inside shortcut grids. |
| **`FeatureDetailScreen`**| `FeatureDetailScreen.tsx` | Reusable generic view for feature details. |
| **`CustomiseSheetModal`**| `CustomiseSheetModal.tsx` | Dashboard widget customization sheet. |
| **`CustomiseDeckZone`**| `CustomiseDeckZone.tsx` | Customizable dashboard card zone. |
| **`CustomiseAvailableZone`**| `CustomiseAvailableZone.tsx` | Zone containing available widget tiles. |

---

## 10. Authentication & Security UI (`components/auth/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`BiometricUnlockButton`**| `BiometricUnlockButton.tsx` | Touch ID / Face ID quick unlock trigger button. |
| **`OtpInputField`** | `OtpInputField.tsx` | Multi-digit SMS OTP verification input box. |
| **`PasswordStrengthIndicator`**| `PasswordStrengthIndicator.tsx` | Real-time visual password strength bar (Weak, Medium, Strong). |
| **`SocialAuthButton`**| `SocialAuthButton.tsx` | Google / Apple SSO authentication button. |
| **`TermsConsentCheckbox`**| `TermsConsentCheckbox.tsx` | Terms of Service agreement checkbox line. |

---

## 11. Analytics & Reports (`components/analytics/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`RealtimeMetricChart`**| `RealtimeMetricChart.tsx` | Live updating chart widget for foot traffic and entries. |
| **`ActivityHeatmap`**| `ActivityHeatmap.tsx` | Weekly activity density heatmap. |
| **`ConversionFunnelView`**| `ConversionFunnelView.tsx` | Step-by-step funnel visualization. |
| **`ExportReportButton`**| `ExportReportButton.tsx` | PDF / Excel report export trigger button. |

---

## 12. App Settings & Maintenance (`components/settings/`)

| Component Name | File | Primary Purpose & Key Props |
| :--- | :--- | :--- |
| **`ThemeToggleSwitch`**| `ThemeToggleSwitch.tsx` | Dark / Light theme toggle switch. |
| **`LanguageSelector`**| `LanguageSelector.tsx` | Language picker (English / Arabic / Hindi). |
| **`PermissionRequestCard`**| `PermissionRequestCard.tsx` | Card prompting user for system permissions (Camera, Location, Push). |
| **`DiagnosticLogViewer`**| `DiagnosticLogViewer.tsx` | Embedded log viewer for mobile app troubleshooting. |
| **`StorageCleanerWidget`**| `StorageCleanerWidget.tsx` | Cache and offline storage cleanup widget. |
| **`OnboardingCarousel`**| `OnboardingCarousel.tsx` | Multi-slide feature onboarding carousel. |
| **`AppVersionFooter`**| `AppVersionFooter.tsx` | Footer text showing app build version and copyright. |

---

## Standard Barrel Import Usage Examples

```tsx
// Example: Creating a Visitor Pass List View using Barrel Exports
import React from 'react';
import {
  ScreenShell,
  ListCard,
  StatusBadge,
  Button,
  EmptyState,
} from '@/components';
import { Plus } from 'lucide-react-native';

export default function VisitorListScreen() {
  const visitors = [/* ... */];

  return (
    <ScreenShell
      title="Visitor Passes"
      subtitle="Manage expected and past visitors"
      iconName="UserCheck"
      headerRight={
        <Button variant="default" size="sm">
          New Pass
        </Button>
      }
    >
      {visitors.length === 0 ? (
        <EmptyState
          title="No Active Visitor Passes"
          description="Create a pass to allow guests easy access through the security gate."
        />
      ) : (
        visitors.map((item) => (
          <ListCard
            key={item.id}
            title={item.name}
            subtitle={`Pass Code: ${item.passCode}`}
            statusBadge={<StatusBadge label={item.status} variant="success" dot />}
          />
        ))
      )}
    </ScreenShell>
  );
}
```

---

## Reference Domain Architecture: Visitor Management Component Mapping

The Visitor Management module (`src/features/visitor/components/`) serves as the reference baseline for extending catalog primitives into domain-specific features:

| Visitor Domain Component | Physical Path | Primary Catalog Primitives Reused |
| :--- | :--- | :--- |
| **`VisitorPassCard`** | `src/features/visitor/components/VisitorPassCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Button>` |
| **`VisitorPassDetailsModal`** | `src/features/visitor/components/VisitorPassDetailsModal.tsx` | `<BottomSheet>`, `<DetailSection>`, `<DetailRow>`, `<StatusBadge>` |
| **`CreateVisitorPassSheet`** | `src/features/visitor/components/CreateVisitorPassSheet.tsx` | `<BottomSheet>`, `<TextInput>`, `<DropdownSelect>`, `<DatePicker>` |
| **`WalkInApprovalCard`** | `src/features/visitor/components/walkin/WalkInApprovalCard.tsx` | `<Icon>`, `<StatusBadge>`, `<Button>`, `<Text>` |
| **`WalkInVisitorDetailsModal`** | `src/features/visitor/components/walkin/WalkInVisitorDetailsModal.tsx` | `<BottomSheet>`, `<DetailSection>`, `<DetailRow>`, `<ConfirmationModal>`, `<StatusBadge>`, `<Button>` |
| **`GuardQRScannerModal`** | `src/features/visitor/components/guard/GuardQRScannerModal.tsx` | `<Modal>`, `<QRScannerOverlay>`, `<TextInput>`, `<Button>` |
| **`VisitorHistoryView`** | `src/features/visitor/components/history/VisitorHistoryView.tsx` | `<PaginatedList>`, `<SearchFilterBar>`, `<EmptyState>` |
| **`VisitorAnalyticsCard`** | `src/features/visitor/components/admin/VisitorAnalyticsCard.tsx` | `<KPICard>`, `<KPIRow>` |
| **`AdminBlacklistModal`** | `src/features/visitor/components/admin/AdminBlacklistModal.tsx` | `<Modal>`, `<TextInput>`, `<Button>` |
| **`BlacklistEntryCard`** | `src/features/visitor/components/admin/BlacklistEntryCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Button>`, `<Text>` |
| **`VisitorPassWizard`** | `src/features/visitor/components/wizard/VisitorPassWizard.tsx` | `VisitorPassStepIndicator`, `VisitorPassFlowHeader`, `VisitorPassFlowFooter` |

---

## Reference Domain Architecture: Financial Suite, Billing & Ledgers

The Financial & Billing module (`src/features/billing/components/` & `src/features/amenities/components/`) standardizes financial statements, wallets, and ledgers:

| Financial Domain Component | Physical Path | Primary Catalog Primitives Reused |
| :--- | :--- | :--- |
| **`InvoiceCard`** | `src/features/billing/components/InvoiceCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Text>` |
| **`AmenityLedgerCard`** | `src/features/amenities/components/AmenityLedgerCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Text>` |
| **`WalletTransactionCard`** | `src/features/wallet/components/WalletTransactionCard.tsx` | `<Icon>`, `<StatusBadge>`, `<Text>`, `<Pressable>` |
| **`ResidentDueCard`** | `src/features/billing/components/ResidentDueCard.tsx` | `<Icon>`, `<StatusBadge>`, `<Button>`, `<Text>` |
| **`PaymentReceiptCard`** | `src/features/billing/components/PaymentReceiptCard.tsx` | `<Icon>`, `<StatusBadge>`, `<Button>`, `<Text>`, `<TouchableOpacity>` |
| **`PaymentResultHeroCard`** | `src/features/billing/components/PaymentResultHeroCard.tsx` | `<Icon>`, `<StatusBadge>`, `<Text>` |
| **`InvoiceActionsBottomSheet`** | `src/features/billing/components/InvoiceActionsBottomSheet.tsx` | `<BottomSheet>`, `<DetailRow>`, `<Button>`, `<StatusBadge>` |
| **`OfflineSettleSheet`** | `src/features/billing/components/OfflineSettleSheet.tsx` | `<BottomSheet>`, `<TextInput>`, `<Button>` |
| **`PaymentCheckoutSheet`** | `src/features/billing/components/PaymentCheckoutSheet.tsx` | `<BottomSheet>`, `<Button>`, `<StatusBadge>` |
| **`BookingDetailModal`** | `src/features/amenities/components/BookingDetailModal.tsx` | `<BottomSheet>`, `<DetailRow>`, `<Button>`, `<StatusBadge>` |
| **`WalletTopUpModal`** | `src/features/amenities/components/WalletTopUpModal.tsx` | `<BottomSheet>`, `<TextInput>`, `<Button>`, `<Pressable>` |
| **`AssessmentRuleCard`** | `src/features/billing/components/AssessmentRuleCard.tsx` | `<StatusBadge>`, `<Button>`, `<Icon>`, `<Text>` |


---

## Reference Domain Architecture: Incident Intake & Maintenance Helpdesk

The Complaints & Maintenance module (`src/features/complaints/components/`) standardizes intake and issue tracking:

| Complaints Domain Component | Physical Path | Primary Catalog Primitives Reused |
| :--- | :--- | :--- |
| **`RaiseTicketForm`** | `src/features/complaints/components/RaiseTicketForm.tsx` | `<ScreenShell>`, `<TextInput>`, `<DropdownSelect>`, `<AttachmentPicker>`, `<ActionBar>`, `<ConfirmationModal>`, `<ErrorBanner>` |
| **`TechnicianWorkOrderCard`** | `src/features/complaints/components/TechnicianWorkOrderCard.tsx` | `<StatusBadge>`, `<Button>`, `<Text>` |
| **`ProofOfWorkModal`** | `src/features/complaints/components/ProofOfWorkModal.tsx` | `<BottomSheet>`, `<TextInput>`, `<AttachmentPicker>`, `<Button>` |
| **`ComplaintTriageCard`** | `src/features/complaints/components/ComplaintTriageCard.tsx` | `<StatusBadge>`, `<Button>`, `<Text>` |
| **`TicketStatusUpdateModal`** | `src/features/complaints/components/TicketStatusUpdateModal.tsx` | `<BottomSheet>`, `<TextInput>`, `<Button>` |
| **`TicketEscalationModal`** | `src/features/complaints/components/TicketEscalationModal.tsx` | `<BottomSheet>`, `<TextInput>`, `<Button>` |
| **`TicketDispatchCard`** | `src/features/complaints/components/TicketDispatchCard.tsx` | `<StatusBadge>`, `<Button>`, `<Text>` |
| **`AssignTechnicianSheet`** | `src/features/complaints/components/AssignTechnicianSheet.tsx` | `<BottomSheet>`, `<StatusBadge>`, `<TextInput>`, `<Button>` |
| **`AmenityMasterCard`** | `src/features/amenities/components/AmenityMasterCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Button>`, `<Text>` |
| **`AmenityCatalogCard`** | `src/features/amenities/components/AmenityCatalogCard.tsx` | `<ListCard>`, `<StatusBadge>`, `<Button>`, `<Text>` |

---

## Reference Domain Architecture: Detail Inspectors & Interactive Viewers (Archetype D)

The Detail Inspectors and Interactive Viewers standardize deep-dive inspection views, PDF statement generators, and interactive voting ballots:

| Domain Component / Screen | Physical Path | Primary Catalog Primitives Reused |
| :--- | :--- | :--- |
| **`InvoiceDetailsScreen`** | `src/features/billing/screens/InvoiceDetailsScreen.tsx` | `<ScreenShell>`, `<DetailSection>`, `<DetailRow>`, `<StatusBadge>`, `<ProgressBar>`, `<Button>`, `<PaymentCheckoutSheet>`, `<EmptyState>`, `<ErrorBanner>`, `<SkeletonLoader>` |
| **`PollDetailScreen`** | `src/features/poll/screens/PollDetailScreen.tsx` | `<ScreenShell>`, `<DetailSection>`, `<DetailRow>`, `<StatusBadge>`, `<PollOptionRow>`, `<EmptyState>`, `<ErrorBanner>`, `<SkeletonLoader>` |
| **`PollOptionRow`** | `src/features/poll/components/PollOptionRow.tsx` | `<Pressable>`, `<Text>`, `<Icon>`, `<ProgressBar>` |
| **`PublicVisitorPassScreen`** | `src/features/visitor/screens/PublicVisitorPassScreen.tsx` | `<ScreenShell>`, `<VisitorQRCode>`, `<DetailSection>`, `<DetailRow>`, `<StatusBadge>`, `<TextInput>`, `<Button>`, `<EmptyState>`, `<ErrorBanner>`, `<SkeletonLoader>` |
| **`VisitorQRCode`** | `src/features/visitor/components/shared/VisitorQRCode.tsx` | `<Svg>`, `<Rect>`, `<Text>` |

---

## Reference Domain Architecture: Type-Selection-First Creation Wizards & Archetype Onboarding

The multi-step creation wizards standardize archetype selection bottom sheets, dynamic step routers, static locked headers, and step form layouts:

| Domain Component / Wizard | Physical Path | Primary Catalog Primitives Reused |
| :--- | :--- | :--- |
| **`VisitorInvitationTypeSheet`** | `src/features/visitor/components/wizard/VisitorInvitationTypeSheet.tsx` | `<BottomSheet>`, `<Card>`, `<StatusBadge>`, `<Icon>`, `<Text>` |
| **`VisitorPassWizard`** | `src/features/visitor/components/wizard/VisitorPassWizard.tsx` | `<ScreenShell>`, `<VisitorPassFlowHeader>`, `<VisitorPassStepIndicator>`, `<VisitorPassFlowFooter>` |
| **`AmenityArchetypeSheet`** | `src/features/amenities/components/creation-wizard/AmenityArchetypeSheet.tsx` | `<BottomSheet>`, `<Card>`, `<StatusBadge>`, `<Icon>`, `<Text>` |
| **`AmenityCreationWizard`** | `src/features/amenities/components/creation-wizard/AmenityCreationWizard.tsx` | `<Modal>`, `<AmenityCreationFlowHeader>`, `<AmenityCreationFlowFooter>`, `<BasicFacilityInfoStep>`, `<ScheduleConfigurationStep>` |
| **`AmenityCreationFlowHeader`** | `src/features/amenities/components/creation-wizard/AmenityCreationFlowHeader.tsx` | `<StatusBadge>`, `<Button>` (Static read-only type badge, no mid-flow switch dropdown) |
| **`BasicFacilityInfoStep`** | `src/features/amenities/components/creation-wizard/steps/BasicFacilityInfoStep.tsx` | `<TextInput>`, `<DropdownSelect>`, `<AttachmentPicker>` (Details first, dropzone at bottom, auto system code) |






