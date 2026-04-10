# Tactical Radio -- Setup Guide

## Prerequisites

- **Node.js 18+** -- check with `node --version`
- **JDK 17** -- check with `java --version` (Android Studio bundles one, or install via `brew install openjdk@17` / your package manager)
- **Android Studio** with SDK 34 installed (SDK Manager > Android 14.0 / API 34)
- **Android device** (physical recommended for WebRTC) or emulator with Google Play Services
- **npm** or **yarn** -- this guide uses npm

## Step 1: Clone and Install Dependencies

The `android/` directory and all source code are already included in the repo.

```bash
git clone https://github.com/haakonhaug/tactical-radio.git
cd tactical-radio
npm install
```

This installs all packages listed in `package.json` including Firebase, React Navigation, and WebRTC.

## Step 3: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (e.g., "tactical-radio")
3. **Enable Anonymous Authentication:**
   - Navigate to Authentication > Sign-in method
   - Click Anonymous > Enable > Save
4. **Create a Realtime Database:**
   - Navigate to Build > Realtime Database > Create Database
   - Choose your preferred region (pick one geographically close to your users)
   - Start in **Test mode** (you will apply proper security rules in the next step)
5. **Apply security rules:**
   - Open Realtime Database > Rules tab
   - Replace the contents with the rules from `firebase-rules.json` in the project root
   - Click Publish
6. **Add an Android app:**
   - In Firebase Console, click the Android icon to add an app
   - Package name: `com.radio`
   - Register the app
   - Download `google-services.json`
   - Place it at: `android/app/google-services.json`

## Step 4: Add google-services.json

Place the `google-services.json` file you downloaded from Firebase Console at:

```
android/app/google-services.json
```

Everything else (Gradle plugins, permissions, Kotlin sources) is already configured in the repo.

## Step 5: Run the App

Make sure you have a device connected (`adb devices`) or an emulator running.

```bash
# Start Metro bundler in one terminal
npx react-native start

# In another terminal, build and install
npx react-native run-android
```

If Metro is already running, you can also use:

```bash
npx react-native run-android --active-arch-only
```

This builds only for your device's CPU architecture, which is faster.

## Step 6: Build Release APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

> For a signed release build, you will need to configure signing in `android/app/build.gradle`. See the [React Native docs on signed APKs](https://reactnative.dev/docs/signed-apk-android).

## Troubleshooting

### WebRTC / Calls Not Connecting

- **Physical device recommended:** WebRTC audio works best on real hardware. Emulators may have microphone issues.
- **Google Play Services required:** The emulator must have Google Play Services installed for Firebase to work.
- **Corporate firewalls / strict NAT:** If calls fail to connect, you likely need a TURN server. The app currently uses only Google STUN servers, which handle most NAT scenarios but not all.
  - Free TURN option: [Open Relay by Metered](https://www.metered.ca/tools/openrelay/)
  - Add TURN server credentials in `src/types/index.ts` in the `ICE_SERVERS` array:
    ```typescript
    {
      urls: 'turn:your-turn-server.com:443?transport=tcp',
      username: 'your-username',
      credential: 'your-credential',
    }
    ```

### Firebase Issues

- **Database region:** Choose a region close to your users for lowest latency. Realtime Database region cannot be changed after creation.
- **"Permission denied" errors:** Make sure you applied the rules from `firebase-rules.json` in the Realtime Database Rules tab.
- **google-services.json not found:** Ensure the file is placed at exactly `android/app/google-services.json` (not in the project root).

### Build Errors

- **JDK version mismatch:** React Native 0.74 requires JDK 17. Check with `java --version`.
- **SDK not found:** Ensure `ANDROID_HOME` environment variable is set. Typically:
  - macOS: `export ANDROID_HOME=$HOME/Library/Android/sdk`
  - Linux: `export ANDROID_HOME=$HOME/Android/Sdk`
  - Windows: `set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`
- **Gradle daemon issues:** Try `cd android && ./gradlew --stop && ./gradlew clean` then rebuild.

### Metro Bundler

- **"Unable to resolve module" errors:** Try clearing the cache:
  ```bash
  npx react-native start --reset-cache
  ```

## Architecture Overview

```
Firebase Realtime Database          WebRTC (P2P)
        |                                |
   Signaling                      Encrypted Audio
   + Presence                     DTLS-SRTP / AES-128
   + Call state                        |
        |                              |
   [Device A] <---- ICE/STUN ----> [Device B]
```

- **Firebase Realtime Database:** Acts as the signaling server and presence system. Handles call initiation, acceptance, rejection, and ICE candidate exchange.
- **WebRTC:** Establishes a direct peer-to-peer encrypted audio channel between devices. Audio never passes through any server.
- **Security:** All audio is encrypted end-to-end using DTLS-SRTP (AES-128). Firebase signaling data is transient and cleaned up after calls.
- **NAT Traversal:** Handled automatically by the ICE framework using STUN servers. For restrictive networks, add TURN servers as described above.
- **Race conditions:** Prevented by Firebase atomic transactions for call state management.
