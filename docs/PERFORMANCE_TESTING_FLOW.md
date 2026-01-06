# Performance Testing Flow

This document outlines the standard testing procedures to audit the performance of the Weave application using the newly added performance instrumentation.

## Prerequisites

- Ensure you are running the app in development mode (`npx expo run:ios` or `npx expo run:android`).
- Have the Metro server terminal visible to see the logs.
- Focus on the lines starting with `[PERF]`.

---

## 1. Scenario A: Cold App Launch

**Objective**: Measure the time it takes for the app to become usable from a cold start.

**Steps**:
1.  Completely kill the app (swipe up from multitasking view).
2.  Tap the Weave icon to launch the app.
3.  Observe the terminal logs.

**What to look for**:
- `[PERF][...] [App] RootLayout Mounted`
- Note the timestamp or perceived delay before this log appears.

---

## 2. Scenario B: Oracle FAB Launch (Performance Bottleneck #1)

**Objective**: Measure the latency between tapping the Oracle FAB and the chat interface becoming visible/interactive.

**Steps**:
1.  Navigate to the Home Screen.
2.  Clear the terminal logs (optional, for clarity).
3.  Tap the floating "Weave" button (Oracle FAB) in the bottom left.
4.  Wait for the Oracle Sheet to fully open and the Chat to load.

**What to look for**:
- `[PERF][...] [Oracle] FAB Pressed` (Time zero)
- `[PERF][...] [Oracle] Sheet Opened (Visible)`
- `[PERF][...] [Oracle] Chat Component Mounted`
- `[PERF][...] [Oracle] Messages Rendered`

**Success Criteria**:
- The delta between "FAB Pressed" and "Sheet Opened" should be under 100ms.
- The delta between "Sheet Opened" and "Messages Rendered" should be under 200ms.

---

## 3. Scenario C: Journal Launch & Navigation (Performance Bottleneck #2)

**Objective**: Measure the time to load the Journal feed and switch tabs.

**Steps**:
1.  Navigate to the Home Screen.
2.  Tap the "Journal" widget or navigation item.
3.  Switch between the tabs (Feed, Reflections, Friends, Calendar).

**What to look for**:
- `[PERF][...] [Journal] Home Mounted`
- `[PERF][...] [Journal] START Fetch Feed Entries`
- `[PERF][...] [Journal] END Fetch Feed Entries - Duration: Xms`

**Success Criteria**:
- Feed loading should take under 500ms.
- Tab switching should feel instantaneous.

---

## 4. Reporting Findings

When reporting issues, please copy the log segment containing the `[PERF]` tags.

**Example Log Block**:
```
[PERF][10:23:45.123][Oracle] FAB Pressed
[PERF][10:23:45.450][Oracle] Sheet Opened (Visible)  <-- 327ms delay (Too slow!)
[PERF][10:23:45.500][Oracle] Chat Component Mounted
```
