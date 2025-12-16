# Architectural Audit & Improvement Report

**Date:** October 26, 2023
**Scope:** Deep architectural review of Weave codebase, with specific focus on Notifications and Suggestion Engine.

---

## 1. Executive Summary

The Weave application has a solid conceptual foundation with a clear domain model (WatermelonDB). However, the implementation suffers from significant **tight coupling** and **circular dependencies** between core modules (`interactions`, `intelligence`, `notifications`). This makes the system fragile, difficult to test, and prone to "spaghetti code" issues where changing one module breaks another.

**Key Critical Findings:**
1.  **Circular Dependencies:** The `src/modules` structure is compromised. `interactions` depends on `intelligence`, which depends on `interactions`. `notifications` imports from everywhere.
2.  **Suggestion Engine "Echo Chamber":** The current candidate selection logic heavily biases towards friends you are *already* interacting with, effectively "starving" suggestions for reconnecting with dormant friends, especially for power users.
3.  **"Power User" Suggestion Gap:** Users with very high relationship scores (>85) may receive *fewer* suggestions because the logic assumes they don't need "maintenance," leaving them with only generic "celebration" prompts or nothing at all.
4.  **Notification Fragility:** The `EveningDigest` and other notifications rely on a pull-based, app-open trigger mechanism that is prone to being missed if the user doesn't open the app frequently.

---

## 2. Architecture Review

### 2.1. Module Boundaries & Circular Dependencies
**Status:** 🔴 **Critical**

The project attempts a modular architecture (`src/modules/*`), but the boundaries are not respected.
-   **The Cycle:** `interactions` (logic for logging events) needs `intelligence` (to calculate scores). `intelligence` (logic for scores/insights) needs `interactions` (to get history).
-   **The Consequence:** You cannot easily isolate `intelligence` for unit testing without mocking the entire DB layer of `interactions`.
-   **Recommendation:** Introduce a **Core Data Layer** or **Event Bus**.
    -   *Move* shared DTOs (Data Transfer Objects) to `src/shared/types`.
    -   *Decouple* via Events: instead of `interactions` calling `intelligence.calculateScore()`, it should emit `INTERACTION_LOGGED`. The `intelligence` module listens, calculates, and updates the DB independently.

### 2.2. Data Layer (WatermelonDB)
**Status:** 🟡 **Moderate**

-   **Schema:** Generally well-normalized.
-   **Risk:** Usage of JSON columns for complex relationships (e.g., `suggested_friend_ids` in `EventSuggestionFeedback`) limits the ability to query "who was suggested?" efficiently.
-   **Logic Leaks:** Business logic is leaking into Models (e.g., `Friend.ts` having getters that do logic). Models should be dumb data containers; logic belongs in Services.

### 2.3. Shared Infrastructure
**Status:** 🟡 **Moderate**

-   **"God" Components:** `AppProviders` and `app/_layout.tsx` are becoming dumping grounds for global state.
-   **AsyncStorage Scattering:** Configuration and state are scattered across `AsyncStorage` calls in various files (`notification-store.ts`, `permission.service.ts`, `suggestion-storage.service.ts`). This makes "clearing user data" or "migrating state" error-prone.

---

## 3. Suggestion Engine Deep Dive

### 3.1. The "Power User" Gap (Why you aren't getting suggestions)
**Issue:** The suggestion logic is tiered by "Score":
-   **Score < 50:** `DriftGenerator` triggers (Reconnect).
-   **Score 40-85:** `MaintenanceGenerator` triggers (Keep warm).
-   **Score > 85:** `DeepenGenerator` triggers (Celebrate).

**The Bug:** If you are a power user, your friends likely have scores > 85. `DeepenGenerator` is the *only* one active. If it fails to find a "contextual action" (e.g., no recent life event to celebrate), it returns `null`.
**Result:** **Silence.** The system thinks you are doing "too well" to need help.

**Proposed Solution:**
-   **Universal Maintenance:** Allow `MaintenanceGenerator` to trigger for scores > 85 if `DeepenGenerator` produces nothing. Even best friends need a "let's grab coffee" nudge sometimes, not just "celebrations".
-   **Wildcard Injection:** Force-inject 1 "Wildcard" suggestion (random friend) into the daily mix regardless of score, to ensure variety.

### 3.2. The "Echo Chamber" Effect
**Issue:** `SuggestionCandidateService.getCandidates(50)` selects who to generate suggestions for.
1.  It picks "Drifting" friends (Score < 50).
2.  It picks "Recent Interactions" (Active friends).
3.  It fills the rest with "Stale" friends.

**The Bug:** For a power user, categories #1 and #2 might fill the entire 50-slot limit. You effectively *never* get suggestions for friends who aren't in crisis (drifting) or already active. You never see the "middle" of your network.

**Proposed Solution:**
-   **Quota System:** Enforce strict quotas for the 50 candidates:
    -   20 slots for "Needs Attention" (Drifting/Maintenance).
    -   15 slots for "Active" (Recent context).
    -   15 slots **Reserved** for "Random/Stale" (haven't seen in a while but not drifting).
-   **Outcome:** This guarantees you see a mix of people, breaking the echo chamber.

### 3.3. Performance (N+1 Queries)
**Issue:** `fetchSuggestions` iterates over the candidate list. Inside the loop, generators often call `analyzeInteractionPattern`, which may trigger lazy-loading of interactions if not properly pre-loaded.
**Recommendation:** Implement a `BulkContextLoader` that fetches *all* necessary interaction history for *all 50 candidates* in one optimized query before the generation loop starts.

---

## 4. Notification System Deep Dive

### 4.1. Fragility of Schedules
**Issue:** The `EveningDigest` depends on the user opening the app to run `notification-orchestrator.ts`, which then schedules the *local* notification for the evening.
-   If you don't open the app today, you don't get a digest tonight.
-   If the app is killed by the OS, the scheduler might not run.

**Recommendation:**
-   **Background Fetch:** Utilize `expo-background-fetch` to wake the app periodically (e.g., every 6 hours) to run the scheduler, ensuring notifications are queued even if the user hasn't foregrounded the app.

### 4.2. Storage Fragmentation
**Issue:** Notification state (e.g., "did we ask for permissions?", "last run time") is stored in ad-hoc `AsyncStorage` keys across multiple files.
**Recommendation:** Consolidate ALL notification-related state into the existing `NotificationStore`.

---

## 5. Specific Improvement Plan

### Immediate Fixes (High Impact / Low Effort)
1.  **Fix Power User Suggestion Logic:**
    -   Modify `MaintenanceGenerator` to accept scores > 85 as a fallback.
    -   Modify `DeepenGenerator` to provide a generic "Hang out" suggestion if no specific "Celebration" context is found.
2.  **Fix Echo Chamber:**
    -   Update `SuggestionCandidateService.getCandidates` to strictly reserve 30% of slots for "Stale" friends (random sort of friends not interacted with in > 30 days).

### Medium Term (Architecture)
3.  **Consolidate Notification State:** Refactor `permission.service.ts` and `notification-analytics.ts` to use `NotificationStore`.
4.  **Implement Background Scheduling:** Add a background task to ensure `EveningDigest` is scheduled daily.

### Long Term (Refactor)
5.  **Break Module Cycles:** Create a `@/core` module for shared Types and the Event Bus. Refactor `interactions` and `intelligence` to communicate via events.
