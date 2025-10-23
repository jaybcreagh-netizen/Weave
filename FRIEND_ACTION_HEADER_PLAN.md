# Dynamic Friend Action Header: Implementation Plan

## 1. The Problem: Static & Reactive Buttons

The current friend profile screen uses three separate, static buttons:
1.  **Connect By:** A conditional button that shows a "due date" to maintain a score. This can create pressure.
2.  **Log a Weave:** A generic button to log a past interaction.
3.  **Plan a Weave:** A generic button to plan a future interaction.

These buttons are not context-aware. They don't adapt to the relationship's current state, nor do they guide the user toward the most meaningful action.

## 2. The Solution: A Single, Dynamic Header

We will replace the three static buttons with a single, intelligent **`FriendActionHeader`** component. This component will analyze the friendship's context and present the user with the single most relevant action.

This transforms the top of the profile from a simple menu into the "brain" for that specific relationship.

## 3. Contextual States & Logic

The header will have several states, determined by a new `useFriendActionState` hook. The logic is as follows:

---

### State 1: Reflect
- **Trigger:** The last interaction was **within the last 24 hours**.
- **Purpose:** To encourage the user to capture the meaning of a recent connection.
- **UI Example:**
    - **Title:** "Recent Weave"
    - **Subtitle:** "How was your recent time together? Take a moment to reflect on it."
    - **Button Text:** "Reflect on Weave"
- **Action:** Opens the reflection editor for the most recent interaction.

---

### State 2: Suggest Reconnect (Drifting)
- **Trigger:** The friend's Weave Score is **below 40**.
- **Purpose:** To provide a specific, low-friction suggestion to rekindle a fading connection, tailored to the friend's archetype.
- **UI Example (for a 'High Priestess' Archetype):**
    - **Title:** "Connection is Drifting"
    - **Subtitle:** "Sarah values deep, one-on-one conversations. Invite her for a coffee chat to reconnect."
    - **Button Text:** "Log a Weave"
- **Action:** Opens the interaction form, pre-filled with the suggested category (e.g., 'Meal/Drink').

---

### State 3: Suggest Deepen (Thriving)
- **Trigger:** The friend's Weave Score is **above 85**.
- **Purpose:** To build on positive momentum and encourage high-quality interactions.
- **UI Example:**
    - **Title:** "Your Bond is Thriving"
    - **Subtitle:** "You have a strong connection. Plan something special to deepen it further."
    - **Button Text:** "Plan a Weave"
- **Action:** Opens the interaction form with the `plan` type selected.

---

### State 4: Maintain (Stable)
- **Trigger:** The friend's Weave Score is **between 40 and 85**.
- **Purpose:** To provide a gentle, low-effort nudge to keep the connection warm.
- **UI Example:**
    - **Title:** "Keep the Thread Warm"
    - **Subtitle:** "A simple voice note or text can maintain your connection."
    - **Button Text:** "Log a Quick Weave"
- **Action:** Opens the interaction form, pre-filled with a low-effort category like 'Text/Call' or 'Voice Note'.

---

### State 5: First Weave (New Friend)
- **Trigger:** The friend has **zero interactions** logged.
- **Purpose:** To guide the user on how to start weaving with a new friend.
- **UI Example:**
    - **Title:** "A New Thread"
    - **Subtitle:** "Log your first weave with this friend to begin strengthening your connection."
    - **Button Text:** "Log First Weave"
- **Action:** Opens the interaction form.

## 4. Implementation Steps

1.  **Create Logic Hook (`src/hooks/useFriendActionState.ts`):** Build the hook that contains the state-switching logic described above. It will take the `friend` and their `interactions` as input and return a state object (`{state, title, subtitle, buttonText, action}`).

2.  **Build UI Component (`src/components/FriendActionHeader.tsx`):** Create the presentational component that accepts the state object as props and renders the UI.

3.  **Integrate into Profile (`app/friend-profile.tsx`):** Remove the three old buttons and replace them with the new `<FriendActionHeader />` component, powered by the hook.

## 5. Benefits

-   **Proactive Guidance:** The app tells the user the *best* thing to do, rather than just providing options.
-   **Reduced Cognitive Load:** One clear action is less overwhelming than three generic ones.
-   **Smarter Feel:** Makes the app feel more like an intelligent companion.
-   **Integrates Core Features:** Provides a natural home for the suggestion engine and reflection system.
