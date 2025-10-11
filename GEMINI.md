# GEMINI.md

## Project Overview

Weave is a relationship tracking and reflection app designed to help people stay connected to the relationships that truly matter. It’s inspired by Dunbar’s number — the idea that humans can only meaningfully maintain around 150 social connections. Rather than trying to increase interaction, Weave helps users deepen the quality of connection with those already close to them.

At its core, Weave is about making the invisible visible — visualizing how friendships ebb and flow over time, and providing gentle prompts to reconnect when bonds cool. The app blends ritual, reflection, and planning into one lightweight system: users can log past interactions (“weaves”) or plan future ones, gradually creating a living timeline that reflects the emotional history of each friendship.

The design ethos prioritizes warmth, calm, and narrative clarity over gamification. Every screen should feel meaningful, intentional, and low-friction — more like a guided journal than a social feed. Visual metaphors (threads, gradients, moon phases) help users intuitively understand the state of their relationships without relying on metrics or notifications. Ultimately, Weave is a tool for emotional awareness disguised as a simple relationship tracker. It’s built to encourage reflection, restore intention to how we socialize, and remind users that maintaining connection is both a science and an art.

This project is the React Native implementation of Weave, built using the Expo framework.

**Key Technologies:**

*   **Framework:** React Native with Expo
*   **Language:** TypeScript
*   **Navigation:** `expo-router`
*   **UI:**
    *   Core React Native components.
    *   `react-native-gesture-handler` for gesture support.
    *   `react-native-reanimated` for animations.
    *   `lucide-react-native` for icons.
    *   `react-native-svg` for SVG support.
*   **State Management:** Zustand
*   **Data Layer:**
    *   WatermelonDB and/or Dexie.js for local data persistence. The presence of both suggests a potential migration or that they are used for different purposes.
*   **Architecture:**
    *   The application uses `expo-router` for file-based routing.
    *   The main entry point is `App.tsx`, which sets up the navigation.
    *   The project is configured for both iOS and Android.

## Building and Running

To get the project up and running, follow these steps:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    *   To start the Metro bundler and run the app in the Expo Go app:
        ```bash
        npm start
        ```
    *   To run on an Android emulator or connected device:
        ```bash
        npm run android
        ```
    *   To run on an iOS simulator or connected device:
        ```bash
        npm run ios
        ```
    *   To run the web version:
        ```bash
        npm run web
        ```

## Development Conventions

*   **File-based Routing:** The app uses `expo-router`, so the file structure inside the `app/` directory defines the navigation routes.
*   **Component-Based:** The UI is likely broken down into reusable components located in `src/components`.
*   **State Management:** Global state is managed with Zustand.
*   **Data Persistence:** Data is stored locally using WatermelonDB and/or Dexie.js.
*   **Type Safety:** The project is written in TypeScript.