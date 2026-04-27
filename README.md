# 🎯 Count Your Darts

A feature-rich React Native mobile application built with [Expo](https://expo.dev/) to help you track your dart games, manage players, and analyze your performance.

## ✨ Features

- **Multiple Game Modes**:
  - X01 (Standard Darts)
  - Cricket
  - Around the Clock
  - Bob's 27
  - 100 Darts
- **Player Management**: Keep track of multiple players and their individual progress.
- **Match History & Statistics**: View past games and analyze performance with detailed charts.
- **Multilingual Support**: Available in English and Polish (i18n).
- **Customizable Experience**:
  - Dark and Light themes.
  - Haptic feedback for better interaction.
  - Speech synthesis (reads out scores).
- **Offline Ready**: All data is securely stored locally on your device.

## 🚀 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing) & React Navigation
- **State Management**: React Context API
- **Storage**: `@react-native-async-storage/async-storage`
- **Charts**: `react-native-chart-kit`
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

- `/app` - Expo Router screens and tab navigation.
- `/components` - Reusable UI components.
- `/context` - Global state management (Game, Players, Theme, Language, etc.).
- `/lib` - Utility functions (Checkouts logic, Storage helpers, Theme definitions).
- `/locales` - Translation files (`en.json`, `pl.json`).
- `/assets` - Images, icons, and splash screens.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open-source and available under the MIT License.
