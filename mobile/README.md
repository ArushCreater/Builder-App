# BuilderTrend Pro Mobile App

A comprehensive React Native mobile application for construction project management, built with Expo and TypeScript.

## Features

- **Authentication**
  - Email/Password login and registration
  - Biometric authentication (Face ID / Touch ID)
  - Secure token storage

- **Dashboard**
  - Overview of active projects
  - Quick stats and metrics
  - Priority tasks view
  - Quick actions

- **Projects**
  - Browse all projects
  - Filter by status
  - Search functionality
  - Project details with progress tracking
  - Photo galleries
  - Document management

- **Tasks**
  - Task management with status tracking
  - Priority levels
  - Due date tracking
  - Task assignment

- **Daily Logs**
  - Create daily work logs
  - Camera integration for photos
  - GPS location tagging
  - Weather tracking
  - Manpower tracking
  - Safety incident reporting

- **Offline Support**
  - Offline detection
  - Visual offline banner

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand + React Query
- **API Client**: Axios
- **Camera**: expo-camera
- **Location**: expo-location
- **Storage**: AsyncStorage + SecureStore
- **Authentication**: expo-local-authentication

## Project Structure

```
mobile/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (app)/             # Main app with tab navigation
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point
├── components/            # Reusable components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Header.tsx
│   ├── Loading.tsx
│   └── ErrorMessage.tsx
├── screens/               # Screen components
│   ├── ProjectDetailScreen.tsx
│   ├── TaskDetailScreen.tsx
│   ├── DailyLogFormScreen.tsx
│   ├── PhotoGalleryScreen.tsx
│   └── DocumentsScreen.tsx
├── services/              # API and service layer
│   ├── api.ts            # API client
│   ├── auth.ts           # Authentication service
│   ├── camera.ts         # Camera service
│   └── location.ts       # Location service
├── hooks/                 # Custom hooks
│   ├── useAuth.tsx       # Auth context
│   └── useOffline.tsx    # Offline detection
├── utils/                 # Utility functions
│   └── storage.ts        # Storage wrapper
├── types/                 # TypeScript types
│   └── index.ts
├── app.json              # Expo configuration
├── babel.config.js       # Babel configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android development)
- Expo Go app on your physical device (optional)

### Installation

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your API URL:
   ```
   EXPO_PUBLIC_API_URL=http://your-api-url:3000/api
   ```

### Running the App

**Start the development server:**
```bash
npm start
```

**Run on iOS simulator:**
```bash
npm run ios
```

**Run on Android emulator:**
```bash
npm run android
```

**Run in web browser:**
```bash
npm run web
```

**Scan QR code with Expo Go:**
- Scan the QR code in terminal with Expo Go app on your phone

## Configuration

### API Configuration

Update the API URL in your `.env` file:
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For physical devices, use your machine's IP address instead of localhost.

### Camera Permissions

The app requests camera and location permissions. Make sure to:
- Grant camera access for taking photos
- Grant location access for GPS tagging

### Biometric Authentication

To enable biometric authentication:
1. Device must support Face ID, Touch ID, or fingerprint
2. User must enable it in the More > Settings menu
3. Credentials are stored securely using SecureStore

## Building for Production

### iOS

1. Configure app.json with your bundle identifier
2. Run:
   ```bash
   eas build --platform ios
   ```

### Android

1. Configure app.json with your package name
2. Run:
   ```bash
   eas build --platform android
   ```

## Key Features Implementation

### File-Based Routing

The app uses Expo Router for navigation:
- `(auth)` group for login/register
- `(app)` group for main app with tabs
- Individual route files for detail screens

### Offline Support

The app detects offline status and shows a banner. Future enhancements could include:
- Offline data caching
- Queue sync when back online

### Camera & GPS Integration

- Camera service handles photo capture and upload
- Location service provides GPS coordinates
- Photos are compressed before upload
- Thumbnails are automatically generated

### Form Validation

All forms include proper validation:
- Required field checks
- Email format validation
- Password strength requirements

## API Integration

The app connects to a REST API with the following endpoints:

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Get current user
- `GET /projects` - List projects
- `GET /projects/:id` - Project details
- `GET /tasks` - List tasks
- `POST /daily-logs` - Create daily log
- `POST /photos` - Upload photo

## Troubleshooting

**Metro bundler issues:**
```bash
npx expo start -c
```

**iOS build issues:**
```bash
cd ios && pod install && cd ..
```

**Clear cache:**
```bash
npm start -- --reset-cache
```

## License

Proprietary - BuilderTrend Pro
