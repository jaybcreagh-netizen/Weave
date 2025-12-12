# Refactoring Roadmap: UI/UX Standardization

**Owner:** Design Systems Architect
**Status:** In Progress
**Strategies:**
*   **Styling:** NativeWind (Tailwind CSS) as the primary engine.
*   **Safety:** Systemic "Discard Changes" protection via Shared Components.
*   **Consistency:** Enforced usage of `@/shared/ui` tokens and components.

---

## Phase 1: Standardization & Mapping
**Goal:** Establish a Single Source of Truth for Design Tokens.
**Target Files:**
*   `tailwind.config.js`
*   `src/shared/theme/tokens.ts`
*   `global.css` (if applicable)

**Agent Prompt:**
> You are a Design Systems Engineer. Your task is to align the Tailwind configuration with the application's Design System tokens.
> 1.  Read `src/shared/theme/tokens.ts` to understand the token structure (palette, semantic tokens).
> 2.  Rewrite `tailwind.config.js` to dynamically import `tokens.ts`.
> 3.  Map the tokens into the Tailwind theme configuration.
>     *   **Colors:** Map semantic tokens (e.g., `colors.primary`) to `tokens.light.primary`. *Note: For this phase, map to the Light theme values by default, or implement CSS variable mapping if the environment supports it.*
>     *   **Font Family:** Map `typography.fonts` (e.g., `font-serif` -> `Lora_400Regular`).
>     *   **Border Radius:** Map `radius` (e.g., `rounded-lg` -> `radius.lg`).
> 4.  **Constraint:** Do NOT hardcode hex values in `tailwind.config.js`. It must read from the `tokens` object.
> 5.  **Verification:** Ensure `npx tailwindcss` (if runnable) or a manual review confirms the config is valid JavaScript and correctly structures the theme object.

---

## Phase 2: Core Component Hardening
**Goal:** ensure `@/shared/ui` components are production-ready replacements for raw primitives.
**Target Files:**
*   `src/shared/ui/Text.tsx`
*   `src/shared/ui/Button.tsx`
*   `src/shared/ui/Card.tsx`
*   `src/shared/ui/Icon.tsx`

**Agent Prompt:**
> You are a React Native UI Engineer. Your task is to harden the core shared components to support the new styling strategy.
> 1.  **Text Component:** Refactor `src/shared/ui/Text.tsx` to use `className` (NativeWind) for all variants instead of inline styles or manual string concatenation. ensure it maps to the new Tailwind tokens (e.g., `text-primary`, `font-serif`).
> 2.  **Button Component:** Refactor `src/shared/ui/Button.tsx` to use Tailwind utility classes for variants (solid, outline, ghost) and sizes. Remove inline style logic where possible.
> 3.  **Icon Component:** Ensure `src/shared/ui/Icon.tsx` is robust. It should accept a `className` prop and pass it effectively to the underlying Lucide icon (handling color via `text-` classes if NativeWind supports it, or mapping props).
> 4.  **Constraint:** Do not change the component API (props) unless absolutely necessary. Maintain backward compatibility.

---

## Phase 3: The "Pilot" Migration
**Goal:** Validate the architecture by refactoring one complex component.
**Target Files:**
*   `src/components/SuggestionCard.tsx`

**Agent Prompt:**
> You are a Frontend Refactoring Specialist. Your task is to refactor `SuggestionCard.tsx` to strictly adhere to the Design System.
> 1.  **Imports:** Replace direct `react-native` imports (`Text`, `View` styling) with `@/shared/ui` components (`Text`, `Card`, `Button`).
> 2.  **Icons:** Replace direct `lucide-react-native` imports with the `@/shared/ui/Icon` wrapper.
> 3.  **Styling:** Remove `StyleSheet.create`. Use NativeWind `className` props for all layout and spacing.
> 4.  **Tokens:** Replace any hardcoded hex codes or fonts with Tailwind utility classes (e.g., `bg-card`, `p-md`, `font-serif-bold`).
> 5.  **Verification:** The component should look identical (or better/more consistent) but contain zero raw style objects.

---

## Phase 4: Component Batch Migration
**Goal:** Systematically eliminate "Hall of Shame" technical debt.
**Target Files (Priority Order):**
1.  `src/components/YourPatternsSection.tsx` (High complexity, mixed styles)
2.  `src/components/ArchetypeCard.tsx` (Visual core)
3.  `src/components/WeeklyReflection/*.tsx` (High usage)
4.  `src/components/*Modal.tsx` (Consistency)

**Agent Prompt:**
> You are a Code Migration Assistant. Your task is to refactor the following component: `[INSERT FILENAME]`.
> 1.  **Audit:** Identify all raw `Text`, `View` (with styles), and `StyleSheet` usage.
> 2.  **Replace:** Swap `Text` -> `@/shared/ui/Text`. Swap `Button` -> `@/shared/ui/Button`.
> 3.  **Style:** Convert `StyleSheet` styles to `className` strings using Tailwind tokens.
> 4.  **Clean:** Remove unused imports.
> 5.  **Constraint:** Do not alter business logic or event handlers. Focus purely on the UI layer.

---

## Phase 5: UX Safety Layer
**Goal:** Prevent accidental data loss in Modals and Sheets.
**Target Files:**
*   `src/shared/ui/Sheet/StandardBottomSheet.tsx`
*   `src/shared/ui/Sheet/AnimatedBottomSheet.tsx`
*   `src/shared/ui/Sheet/types.ts`
*   `src/components/EditInteractionModal.tsx` (Implementation Example)

**Agent Prompt:**
> You are a UX Engineer. Your task is to implement "Unsaved Changes" protection.
> 1.  **Infrastructure:** Update `StandardBottomSheet` and `AnimatedBottomSheet` to accept a new prop: `hasUnsavedChanges: boolean`.
> 2.  **Logic:** Modify the `onClose` or `dismiss` handler in these sheets.
>     *   If `hasUnsavedChanges` is true, interrupt the close action.
>     *   Show a native `Alert` (or custom confirmation dialog): "Discard Changes? You have unsaved changes. Are you sure you want to discard them?"
>     *   If confirmed, proceed with closing.
> 3.  **Implementation:** Update `EditInteractionModal.tsx` to calculate a `isDirty` state (comparing current form values to initial values) and pass it to the Sheet's `hasUnsavedChanges` prop.
> 4.  **Verification:** Verify that swiping down or clicking the backdrop triggers the alert when data is modified.
