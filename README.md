# 🎯 Count Your Darts

A feature-rich React Native mobile application built with [Expo](https://expo.dev/) to help you track your dart games, manage players, host tournaments, and deeply analyze your performance.

## ✨ Features

- **🤖 Smart AI & Bots**:
  - Play against bots with varying difficulty levels (from beginner to pro averages).
  - **Adaptive Bot**: Automatically scales to your historical average and adjusts dynamically during the match.
  - Realistic gameplay utilizing Gaussian distribution (normal curve), human-like checkout misses, and aggressive defensive strategies in Cricket.
- **🎯 Multiple Game Modes**:
  - X01 (Standard Darts with custom Check-In/Check-Out rules)
  - Cricket (Standard & No Score)
  - Practice Modes: Around the Clock, Bob's 27, 100 Darts (Scoring)
- **🏆 Tournaments**:
  - Supported formats: Single Knockout, Double Knockout, Round Robin, Groups + Knockout, Groups + Double Knockout.
  - 1 vs 1 (Singles) and 2 vs 2 (Pairs) support.
  - Customizable rules for different phases (Groups, Semifinals, Finals) and 3rd place matches.
- **🌐 Multiplayer**:
  - Local games on a single device.
  - Online Multiplayer: Host a room, share the code, and play across multiple devices.
- **📊 Advanced Match History & Statistics**:
  - Detailed X01 stats: 3-Dart Average, First 9 Average, Checkout %, High Finishes.
  - Cricket stats: MPR (Marks Per Round) and targets closed.
  - Visual data: Heatmaps, Hit Charts, and 10-game Trend graphs.
  - Generate and share beautiful Player Stat Cards as images!
- **⚙️ Customizable Experience**:
  - Multilingual Support (English and Polish).
  - Dark, Light, and System themes.
  - Advanced Haptic feedback (adjustable intensity).
  - Speech synthesis (Voice Announcer reads out your scores).
- **💾 Offline Ready**: All progress and history are securely stored locally on your device.

## 🚀 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **Storage**: `@react-native-async-storage/async-storage`
- **UI & Animations**: `react-native-reanimated`, `react-native-draggable-flatlist`
- **Data Visualization**: `react-native-chart-kit`
- **Device APIs**: `expo-haptics`, `expo-speech`, `expo-sharing`, `react-native-view-shot`
- **i18n**: `i18next` & `react-i18next`

## 📦 Getting Started

### Prerequisites

Make sure you have Node.js installed. We recommend using `npm`.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Count-Your-Darts
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the Expo development server:

```bash
npx expo start
```

Press `a` to open on an Android emulator, `i` for an iOS simulator, or scan the QR code with the Expo Go app on your physical device.

## 📂 Project Structure

- `/app` - Expo Router screens and tab navigation (`(tabs)`, `tournament`, `gamemodes`).
- `/components` - Reusable UI components.
-   `/common` - Base animated UI elements (Buttons, Steppers, Segmented Controls).
-   `/modals` - Popups, alerts, and bottom sheets.
-   `/tournament` - Bracket visualizations (Round Robin, Knockouts).
-   `/keyboards` - Custom dart input methods (Score, Dart, Interactive Board).
-   `/statistics` - Charts and Heatmaps.
- `/context` - Global state management (Game, Players, Theme, Language, Haptics, Speech).
- `/lib` - Utility functions (Checkouts logic, Storage helpers, i18n).
- `/locales` - Translation files (`en.json`, `pl.json`).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open-source and available under the MIT License.
