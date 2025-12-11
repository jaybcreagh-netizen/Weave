# QC Release Checklist

This document outlines the mandatory Quality Control (QC) regime to be performed before rolling out any new version of Weave.

**Goal:** Ensure critical user flows, data integrity, and "smart" features are functioning correctly.
**Audience:** Internal Developer / QA.

---

## 1. Pre-Flight Automated Checks

Before starting manual testing, ensure the codebase is healthy.

- [ ] **Clean Install Check:**
  ```bash
  rm -rf node_modules
  npm install
  ```
- [ ] **Type Check:**
  ```bash
  npm run tsc
  # or npx tsc --noEmit
  ```
  *Must pass with zero errors.*

- [ ] **Run Unit Tests:**
  ```bash
  npm test
  ```
  *All existing tests (Intelligence, Relationships, Interactions) must pass.*

- [ ] **Lint Check:**
  ```bash
  npm run lint
  # or npx eslint .
  ```

---

## 2. Critical Manual Test Scripts

Since UI and Integration flows have low automated coverage, these manual steps are critical.

### A. Fresh Install & Onboarding (The "First Impression")
*Pre-requisite: Uninstall the app completely from the simulator/device.*

1.  **Launch App:** Verify the app opens without crashing.
2.  **Permissions:**
    - Accept/Deny Notifications (verify prompt appears).
    - Accept/Deny Contacts (if applicable).
3.  **Onboarding Flow:**
    - Complete the initial setup screens.
    - Verify you land on the **Home/Dashboard** screen.
    - **Check:** Is the database initialized? (No "Database Error" toasts).

### B. The "Core Loop" (Daily Usage)

1.  **Add a Friend:**
    - Go to **Add Friend**.
    - Enter Name: "Test User".
    - Select a Relationship Tier (e.g., "Close Friend").
    - **Verify:** "Test User" appears on the Dashboard/Friends List.

2.  **Log an Interaction (Weave):**
    - Tap "Test User".
    - Tap **"Log Interaction"** (or "+").
    - Select a type (e.g., "Coffee").
    - Add a note: "Testing weave log".
    - **Save.**
    - **Verify:** The "Last Seen" date updates immediately.
    - **Verify:** The "Relationship Score" (if visible) or "Streak" increments.

3.  **Edit Friend:**
    - Open "Test User".
    - Change Name to "Test User Edited".
    - **Verify:** Name updates on Profile and Dashboard.

4.  **Delete Friend:**
    - Delete "Test User Edited".
    - **Verify:** User is removed from Dashboard.

### C. Intelligence & Smart Features (The "Brain")

1.  **Calendar Scan (Integration):**
    - Go to **Settings** > **Calendar Integration**.
    - Enable permissions.
    - Create a dummy event in the Device Calendar: "Lunch with [Existing Friend Name] yesterday".
    - **Action:** Kill the app and relaunch it (Scanning happens on launch).
    - **Verify:** The app suggests logging an interaction for that friend (check "Suggestions" on Dashboard).

2.  **Insights & Reflections:**
    - *Note: This may require "seeding" data.*
    - Navigate to the **Insights/Reflection** tab.
    - **Check:** Are graphs/charts rendering? (No blank spaces).
    - **Check:** Do text summaries (Story Chips) appear?

### D. Data Integrity & Resilience

1.  **Offline Mode:**
    - Turn off WiFi/Cellular on device.
    - Log an interaction.
    - **Verify:** App does not crash. Interaction is saved locally.
    - Turn WiFi back on.

2.  **Backup & Restore (Critical):**
    - Go to **Settings** > **Export Data**.
    - Save the JSON file.
    - **Wipe Data** (via Settings -> Debug Tools -> Wipe).
    - **Verify:** App is empty (Onboarding state).
    - Go to **Settings** > **Import Data**.
    - Select the JSON file.
    - **Verify:** Your friends and interactions are restored.

### E. Performance Stress Test
*Using the built-in Debug Tools.*

1.  **Generate Load:**
    - Go to **Settings** > **Debug Tools**.
    - Tap **"Generate Test Data"** (Creates 100+ friends).
2.  **Scroll Test:**
    - Scroll rapidly through the Friends List.
    - **Check:** Does it stutter significantly? (Expect some lag, but no freeze/crash).
3.  **Memory Check:**
    - Open ~10 friend profiles in quick succession.
    - **Check:** No crash (OOM).
4.  **Cleanup:**
    - Tap **"Clear Test Data"**.

---

## 3. Automated Test Gap Analysis (Known Risks)

The following areas have **ZERO** automated coverage and rely 100% on the manual checks above. Breakage here will not be caught by `npm test`.

| Risk Area | Complexity | Consequence of Failure |
| :--- | :--- | :--- |
| **Onboarding UI** | High | User cannot enter the app (Churn). |
| **Calendar Sync** | High | "Smart" features fail silently. |
| **Data Import/Export** | Medium | User data loss during migration. |
| **Reflection/Oracle** | High | AI features (key value prop) break. |
| **Gamification** | Low | Streaks/Badges don't update (Annoyance). |

**Recommendation:** Prioritize writing Integration Tests (using Jest + Testing Library) for the **Onboarding** and **Data Export** flows next.
