# GEMINI.md

## Project Overview

This project is a React-based web application designed as a personal relationship manager called "Weave". It allows users to track and visualize their interactions with friends, categorizing them into different tiers of closeness. The application is built with Vite, uses TypeScript, and leverages a variety of modern frontend technologies.

**Key Technologies:**

*   **Framework:** React with Vite
*   **Language:** TypeScript
*   **UI:**
    *   Custom components built with Radix UI primitives for accessibility.
    *   Styling is likely done with Tailwind CSS (inferred from class names).
    *   Icons are provided by `lucide-react`.
    *   Charts and visualizations are created with `recharts`.
    *   Animations are handled by `framer-motion`.
*   **State Management:**
    *   Zustand for global UI and data state.
    *   `dexie-react-hooks` for reactive data from the local database.
*   **Data Layer:**
    *   Dexie.js is used to manage a local IndexedDB database for storing friend and interaction data.
*   **Architecture:**
    *   The application follows a component-based architecture.
    *   The main `App.tsx` component manages routing and orchestrates the different views.
    *   State is managed in dedicated stores (`stores/`).
    *   The database logic is encapsulated in `db.ts`.

## Building and Running

To get the project up and running, follow these steps:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    This will start the application on `http://localhost:3000`.

3.  **Build for Production:**
    ```bash
    npm run build
    ```
    This will create a production-ready build in the `build` directory.

## Development Conventions

*   **Component-Based:** The UI is broken down into reusable components located in `src/components`.
*   **Styling:** The project appears to use a utility-first CSS approach, likely with Tailwind CSS.
*   **State Management:** Global state is managed with Zustand, with separate stores for different domains (UI, friends, interactions).
*   **Data Persistence:** All data is stored locally in the browser's IndexedDB using Dexie.js.
*   **Type Safety:** The project is written in TypeScript, and type definitions for data structures are located in `src/components/types.tsx`.
