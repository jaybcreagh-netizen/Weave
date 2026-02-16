# Weave App - Comprehensive QA Testing Guide

This document outlines the standard manual testing procedures to verify the core functionality and UX of Weave. Run through this guide before every beta update.

---

## 🛠 Prerequisites

1.  **Build**: Install the latest build on a physical device (recommended) or simulator.
2.  **Developer Tools**: Ensure you can access `Settings -> Developer Tools`.
3.  **Account**: Access to a fresh account (or ability to reset onboarding).

---

## 🏗 Developer Pipeline (Shortcuts)

Use `Settings -> Developer Tools` to speed up testing.

| Action | Description | When to use |
| :--- | :--- | :--- |
| **Test Onboarding** | Resets tutorial state and navigates to start. | Testing NUX (New User Experience). |
| **Generate Test Data** | Creates 100 friends & interactions. | Testing performance, lists, and search. |
| **Set Season** | Forces Social Season (Resting/Balanced/Blooming). | Testing seasonal UI adaptations. |
| **Boost Streak** | Fakes 5 weeks of history. | Testing gamification/streaks. |
| **Test Evening Digest** | Triggers the evening summary sheet. | Testing notifications & digest UI. |
| **Test Weekly Reflection** | Triggers the Sunday reflection flow. | Testing weekly review cycle. |

---

## 🧪 Test Scenarios

### 1. New User Flow (NUX)
**Goal:** Verify a seamless start for a brand new user.

1.  **Reset App Details**: Go to `Settings -> Developer Tools -> Test Onboarding`.
2.  **Onboarding Screens**:
    -   Swipe through the intro slides.
    -   Verify animations are smooth.
    -   Verify "Get Started" button works.
3.  **Permissions**:
    -   Accept/Deny permissions (Notifications, Contacts).
    -   Verify the app handles denial gracefully (shows explanation).
4.  **First Friend Add**:
    -   Tap "Add Friend" (or "Import Contacts").
    -   Select a contact.
    -   **Verify**: Friend appears in the "Inner Circle" or default tier.
5.  **First Interaction**:
    -   Tap the new friend.
    -   Tap "Log Weave".
    -   Complete the flow (Vibe, Activity).
    -   **Verify**: Home screen updates with "Last connection: Just now".

### 2. Core Engagement Loop
**Goal:** Verify the daily actions of an experienced user.

1.  **Quick Weave (Gesture)**:
    -   Long-press a friend on the Home Screen / Friends List.
    -   Swipe to an interaction type (e.g., "Text", "Hangout").
    -   **Verify**: Interaction is logged immediately with default vibe.
2.  **Detailed Logging**:
    -   Open a Friend Profile.
    -   Tap the floating "+" or "Log Interaction" button.
    -   Select "Hangout", set duration to "2 hours", set Vibe to "High".
    -   Add a note: "Qa Test Note".
    -   **Verify**: Interaction appears in History tab.
3.  **Planning**:
    -   On Friend Profile, tap "Plan".
    -   Set date for tomorrow.
    -   **Verify**: Plan appears in "Upcoming" section of Home/Profile.
    -   **Verify**: Notification is scheduled (check `Settings -> Developer Tools -> View Scheduled Notifications`).

### 3. Intelligence & Insights
**Goal:** Verify the "Brain" of the app is working.

1.  **Archetypes**:
    -   Go to a Friend with >5 interactions.
    -   Tap "Archetype" card (or empty state).
    -   **Verify**: It shows an archetype (e.g., "The Magician") or progress bar.
2.  **RQS (Relationship Quality Score)**:
    -   Check the score on the profile (e.g., "Deepening", "Maintenance").
    -   **Dev Check**: Use `Settings -> Developer Tools -> Test RQS Calculation` for a specific friend log.
3.  **Reciprocity**:
    -   Verify the "Initiation Balance" meter on profile.
4.  **Social Season Adaptation**:
    -   **Action**: Go to `Settings -> Developer Tools -> Set Social Season -> Resting`.
    -   **Verify**: Home screen header text changes (e.g., "Permission to pause").
    -   **Verify**: Interaction suggestions might be lower energy.
    -   **Action**: `Set Social Season -> Blooming`.
    -   **Verify**: Home screen encourages activity.

### 4. Time-Sensitive Features
**Goal:** Verify features that normally only happen at specific times.

1.  **Morning Social Battery**:
    -   **Action**: `Settings -> Developer Tools -> Reset Battery -> Set to 10%`.
    -   **Verify**: Home screen might show "Low Battery" warning or suggest "Hermit" mode.
2.  **Evening Digest**:
    -   **Action**: `Settings -> Developer Tools -> Test Evening Digest`.
    -   **Verify**: Bottom sheet slides up.
    -   **Verify**: It shows today's logged interactions and a "Tomorrow's Focus".
3.  **Weekly Reflection**:
    -   **Action**: `Settings -> Developer Tools -> Test Weekly Reflection`.
    -   **Verify**: Full-screen modal opens.
    -   **Verify**: You can complete the survey (High/Low points).
    -   **Verify**: "Journal Widget" on Home Screen updates after completion.

### 5. Settings & Data
1.  **Theme Switch**:
    -   Toggle Dark/Light mode in Settings.
    -   **Verify**: Text remains readable, backgrounds update, no visual glitches.
2.  **Data Integrity**:
    -   `Settings -> Developer Tools -> Diagnostic Scan`.
    -   **Verify**: No red errors (orphaned records).

### 6. Performance (Stress Test)
1.  **Bulk Data**:
    -   `Settings -> Developer Tools -> Generate Test Data` (Create 100 friends).
    -   Scroll through Friends List fast.
    -   **Verify**: Scroll is 60fps, images load (or placeholders).
    -   **Verify**: Search is responsive.
2.  **Cleanup**:
    -   `Settings -> Developer Tools -> Clear Test Data` once done.

---

## 📝 Bug Reporting Flow

If a test fails:
1.  **Screenshot/Screen Record** the issue.
2.  **Run Diagnostic Scan** in Developer Tools (capture screenshot of result).
3.  **Export Logs** (if available) or note the steps to reproduce.
