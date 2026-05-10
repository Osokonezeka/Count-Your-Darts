# 🎯 Count Your Darts

A feature-rich React Native mobile application built with [Expo](https://expo.dev/) to help you track your dart games, manage players, host tournaments, and deeply analyze your performance.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

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
  - Customizable rules for different phases (Groups, Semifinals, Finals), seeding, and 3rd place matches.
- **🌐 Multiplayer**:
  - Local games on a single device.
  - Online Multiplayer across multiple devices (see the **Online Multiplayer & Firebase** section below).
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
- **💾 Offline Ready & Data Management**: All progress and history are securely stored locally on your device. Export your entire app state as a `.zip` backup, use "Smart Merge" to intelligently restore older data without overwriting new matches, and easily wipe all data with a 1-click Hard Reset.

## 🌐 Online Multiplayer & Firebase (Bring Your Own Database)

The app features a unique decentralized approach to online multiplayer. Instead of relying on a single central server, it allows any player to become a Host using their own free Firebase project!

1. **Host a Game**: Paste your Firebase Firestore configuration in the Multiplayer options. The app will create a private room and generate a QR code / connection string.
2. **Join a Game**: Other players simply scan the Host's QR code using their device's camera or paste the connection string to join the lobby instantly.
3. **Real-time Sync**: Gameplay, tournament brackets, and scores are synchronized in real-time across all connected devices.

## 🚀 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **State Management**: Zustand & Immer
- **Backend / Multiplayer**: Firebase Firestore
- **Storage**: `@react-native-async-storage/async-storage`, `expo-file-system`
- **Data Backup**: `fflate` (ZIP compression)
- **UI & Animations**: `react-native-reanimated`, `react-native-draggable-flatlist`
- **Data Visualization**: `react-native-chart-kit`
- **Device APIs**: `expo-haptics`, `expo-speech`, `expo-sharing`, `react-native-view-shot`, `expo-document-picker`
- **i18n**: `i18next` & `react-i18next`

## 📦 Getting Started

### Prerequisites

Make sure you have Node.js installed. We recommend using `npm`.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Osokonezeka/Count-Your-Darts.git
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
  - `/common` - Base animated UI elements (Buttons, Steppers, Segmented Controls).
  - `/modals` - Popups, alerts, and bottom sheets.
  - `/tournament` - Bracket visualizations (Round Robin, Knockouts).
  - `/keyboards` - Custom dart input methods (Score, Dart, Interactive Board).
  - `/statistics` - Charts and Heatmaps.
- `/context` - React Context providers (Theme, Language, Haptics, Speech).
- `/store` - Zustand stores for efficient global state management (e.g., match states).
- `/lib` - Core business logic, Firebase configs, Backup utilities, Stats calculators, and i18n.
- `/locales` - Translation files (`en.json`, `pl.json`).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open-source and available under the MIT License.
