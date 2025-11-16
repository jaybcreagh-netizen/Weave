# Weave

Weave is a mobile application designed to help you nurture your relationships and build a strong social network. It provides tools to track your interactions, set intentions, and gain insights into your social habits.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Running the app](#running-the-app)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Features

- **Track Interactions:** Log your interactions with friends and family to keep a record of your social connections.
- **Set Intentions:** Set intentions to connect with specific people or in specific ways.
- **Social Insights:** Gain insights into your social habits and identify areas for improvement.
- **Gamification:** Earn achievements and badges for maintaining your social network.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI
- Xcode or Android Studio for running on a simulator/emulator

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/weave.git
   cd weave
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

## Usage

### Running the app

1. **Start the Metro bundler:**
   ```bash
   npx expo start
   ```

2. **Run on a simulator/emulator or a physical device:**
   - Press `i` to run on an iOS simulator.
   - Press `a` to run on an Android emulator.
   - Scan the QR code with the Expo Go app on your physical device.

## Project Structure

- `app/`: Contains the screens and navigation for the app, using `expo-router`.
- `src/`: Contains the source code for the app.
  - `components/`: Reusable components used throughout the app.
  - `hooks/`: Custom React hooks.
  - `lib/`: Core business logic and utility functions.
  - `db/`: Database schema and models for WatermelonDB.
  - `stores/`: Zustand stores for state management.
- `assets/`: Images, fonts, and other static assets.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.
