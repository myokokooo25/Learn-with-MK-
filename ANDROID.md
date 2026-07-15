# Learn with MK — Android

This repo is a **web app** wrapped as an Android app with [Capacitor](https://capacitorjs.com/).

## Requirements

1. **Node.js** 18+
2. **JDK 21** (Capacitor 7 / Android Gradle need Java 21)
3. **Android SDK** Platform 35 + Build-Tools 35  
   Easiest: install [Android Studio](https://developer.android.com/studio) and open the `android` folder once so the SDK installs.

## Quick start (already scaffolded in this repo)

```bash
npm install
npm run cap:sync
npm run android:open
```

Or build a debug APK from the CLI:

```powershell
$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Microsoft\jdk-21*' -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run android:build
```

Debug APK:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install on a phone (USB debugging on):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## After web changes

```bash
npm run cap:sync
```

Then rebuild/run from Android Studio or `npm run android:build`.

## App ID

- Package: `com.learnwithmk.grammar`
- Name: **Learn with MK**

## Play Store release

1. Create a keystore (one time)
2. Android Studio → **Build → Generate Signed Bundle / APK** → Android App Bundle
3. Upload the **AAB** to Google Play Console

## Notes

- Progress / favorites use WebView `localStorage` on the device
- Service worker is skipped inside the native app (assets are bundled)
- Web PWA install still works from the browser
