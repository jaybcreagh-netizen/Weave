# GEMINI.md - Weave Operating Manual & AI Collaboration Protocol

## 1. Core Identity & Vision

At its heart, Weave is a **mindful relationship companion** designed to combat the loneliness, social isolation, and burnout epidemic of the modern age. We are not building another social network. Instead, we are creating a private, intelligent tool that helps people deepen the quality of their most important friendships with intention and awareness.

Our vision is to pioneer a new category of digital wellness focused on **social health**. In an era of superficial digital interactions, there is a profound need for a tool that helps users move from passive, reactive socializing to proactive, meaningful connection. Weave is designed to be that tool—a private sanctuary that makes the invisible ebb and flow of relationships visible and actionable, transforming the mental chore of "keeping in touch" into a calm and rewarding ritual.

---

## 2. Our Target Audience: The Modern Urban Professional

We are building Weave for a specific and underserved demographic: **Millennial and Gen Z urban professionals.**

This audience lives at the intersection of two conflicting realities. On one hand, they manage busy, complex social calendars. On the other, they are the generations most acutely feeling the effects of loneliness and social burnout. They value deep, authentic connections but lack the mental bandwidth to consistently nurture them.

Weave is the solution for this paradox. It acts as a **"second brain" for their relationships**, alleviating the guilt of letting time slip by and providing a structured, gentle framework to invest their limited social energy where it matters most.

---

## 3. The Core Frameworks: Our Intellectual Moat

Weave's architecture is grounded in established science and enriched with an intuitive, qualitative layer.

### 3.1 The Scientific Foundation: The Social Brain & Dunbar's Number

The app's structural backbone is derived from anthropologist Robin Dunbar's **Social Brain Hypothesis**. This provides a scientifically-validated framework for prioritizing social energy. We operationalize this by guiding users to map their key relationships into Dunbar's concentric layers:
*   **~5 Inner Circle:** Your core support system.
*   **~15 Close Friends:** Cherished, important bonds.
*   **~50 Friends:** Meaningful, regular social contact.

This structure informs the entire intelligence engine, tailoring insights and reminders based on the distinct needs of each relational layer.

### 3.2 The Intuitive Soul: The Tarot Archetype Framework

While Dunbar's Number provides quantitative structure, our **7 Tarot Archetypes** provide the qualitative, intuitive soul. This is a symbolic language to define the unique energetic dynamic of each friendship, allowing the "Invisible Intelligence Layer" to offer emotionally intelligent insights.

*   **The Sun:** Thrives on celebration and shared joy.
*   **The Hermit:** Values quality one-on-one time; decay rate is slower.
*   **The Emperor:** Built on structure and mutual respect; rewards consistency.
*   **The Fool:** A spontaneous connection; rewards novel experiences.
*   **The Empress:** A nurturing bond; values acts of care and support.
*   **The Magician:** A creative partnership; rewards proactive collaboration.
*   **The High Priestess:** An intuitive connection; values depth and meaningful conversation.

---

## 4. Technical Architecture & Key Technologies

This project is a React Native application built with the Expo framework.

*   **Framework:** React Native with Expo (SDK 51+)
*   **Language:** TypeScript (Strict Mode enabled)
*   **Navigation:** `expo-router` (File-based routing located in the `app/` directory)
*   **Database:** **WatermelonDB is the single source of truth.** It is our local-first, reactive database for all persistent application data (friends, interactions). *Note: Dexie.js is a legacy dependency and should be ignored.*
*   **State Management:** **Zustand** is used exclusively for managing ephemeral, global UI state (e.g., the visibility of a modal, the current theme).
*   **Core Logic:** The "Invisible Intelligence" engine, containing all scoring and decay mechanics, is located in `src/lib/weave-engine.ts`. This file is the brain of the application.
*   **Entry Point:** The app uses `expo-router/entry`. The root layout and navigation structure are defined in `app/_layout.tsx`.

### **Key Libraries & Their Purpose:**

*   **`@nozbe/watermelondb`**: The primary database for all application data.
*   **`zustand`**: For managing non-persistent, global UI state.
*   **`expo-router`**: For all navigation and routing.
*   **`react-native-reanimated`**: For all performance-critical animations.
*   **`react-native-gesture-handler`**: For handling all touch gestures.
*   **`lucide-react-native`**: The icon library for the entire application.
*   **`date-fns`**: For all date and time manipulations.
*   **`expo-calendar`**: Used for the "Weekly Ritual" and automatic logging features.
*   **`expo-contacts`**: Used during onboarding to import contacts.
*   **`expo-linear-gradient`**: Used for creating gradient effects in the UI.
*   **`expo-blur`**: Used for creating blur effects in modals.

---

## 5. The Collaboration Protocol: How We Work Together

This is the most important section. To ensure a safe, predictable, and efficient workflow, you **MUST** adhere to the following protocol at all times.

### **Rule #1: Always Follow the Prompt Sequence**
I will provide you with a series of numbered prompts. You must treat these as a sequential, ordered plan. Do not jump ahead or combine steps.

### **Rule #2: The "Propose, Don't Impose" Workflow**
Your primary mode of operation is to **propose changes** and **await confirmation.** Never write changes directly to a file without my explicit "Proceed" or "Yes" command.

Your standard workflow for any given prompt is:
1.  **Acknowledge & Plan:** Start by stating you understand the task.
2.  **Read Files:** Use the `ReadFile` tool to get the necessary context.
3.  **Propose the Change:** Present the proposed code changes clearly.
4.  **Ask for Confirmation:** **Crucially, every response where you propose a code change must end with a question asking for my permission to proceed.**

### **Rule #3: Proactive Problem Solving is Encouraged, but Requires Confirmation**
If you spot a problem or a better way to implement something, bring it up, but frame it as a proposal. Example:
> "I have applied the change. However, I've noticed this creates a breaking change in `File B`. My plan is to now read `File B` and propose a fix. Shall I proceed?"

### **Rule #4: Assume I Have the Full Context**
You can assume that I am aware of all our strategic documents. You can refer to concepts like "The Weekly Ritual" or "The Invisible Intelligence Layer," and I will understand.

---

## 6. Building and Running the App

*   **Install Dependencies:** `npm install`
*   **Run on iOS:** `npx expo run:ios`
*   **Run on Android:** `npx expo run:android`
*   **Clear Cache:** `npm start -- --clear`

**Note on Native Modules:** If a warning appears about a "native view manager... not being exported," the fix is always:
1.  Stop the Metro server.
2.  Delete the old app build from the device/simulator.
3.  Run `npx expo run:ios` or `npx expo run:android` to create a fresh build.
