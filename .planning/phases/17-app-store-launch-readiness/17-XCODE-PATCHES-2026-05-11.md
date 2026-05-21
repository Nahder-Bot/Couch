---
phase: 17-app-store-launch-readiness
authored: 2026-05-11
purpose: Copy-paste-ready Info.plist + Xcode capability patches for the PWABuilder-generated iOS project. Open this doc next to Xcode and work top-to-bottom.
related: 17-PWABUILDER-FINDINGS-2026-05-07.md (source of truth for what PWABuilder generated), 17-APPLE-CONFIRMED-2026-05-07.md (locked Apple-side values), 17-LAUNCH-CHECKLIST.md items #26-#34
---

# Phase 17 — Xcode patch checklist

Open `Couch Tonight.xcodeproj` from `~/Downloads/Couch Tonight.zip` (or wherever you extracted it). Work this list top-to-bottom; each section is independent so you can split across sessions.

## 1. Bundle Identifier (PERMANENT post-publish)

**Locked value:** `app.couchtonight.couch` (per `17-APPLE-CONFIRMED-2026-05-07.md`)

**Where to change:**
- Xcode → Project navigator → click the project (top of the tree, blue icon)
- Targets → Couch Tonight → General tab
- "Identity" section → **Bundle Identifier** field → change from `app.couchtonight` to `app.couchtonight.couch`

**Critical:** this value MUST exactly match what's registered in Apple Developer Console (already done) AND what you'll register in Firebase Console for `GoogleService-Info.plist` (see §5 below). Case-sensitive.

## 2. App category → Entertainment

**Where to change (option A — Xcode UI):**
- Same General tab → "Frameworks, Libraries, and Embedded Content" section is irrelevant; scroll up to "Identity"
- There's no UI for app category — this is in Info.plist

**Info.plist path:** `Couch Tonight/Info.plist` → key `LSApplicationCategoryType`
- Current: `public.app-category.productivity`
- New: `public.app-category.entertainment`

**Right-click `Info.plist` in Project navigator → Open As → Source Code** to edit XML directly. Or use the property-list UI editor — both work.

## 3. Remove ATS bypass (NSAllowsArbitraryLoads)

**Why:** couchtonight.app is HTTPS-only — App Transport Security shouldn't be disabled. App Review may flag.

**Info.plist path:** delete the entire `NSAppTransportSecurity` dict OR just delete the `NSAllowsArbitraryLoads = true` key inside it.

```diff
 <key>NSAppTransportSecurity</key>
 <dict>
-  <key>NSAllowsArbitraryLoads</key>
-  <true/>
 </dict>
```

If `NSAppTransportSecurity` becomes empty after the delete, you can remove the whole dict.

## 4. Permission descriptions (camera/mic/location)

**Couch verified 2026-05-11 has NO camera/mic/location usage** (only `<input type=file accept=image/*>` photo picker — no `getUserMedia`, no `navigator.geolocation`). Generic PWABuilder defaults like "Capture Video by user request" will get **rejected by App Review**.

**Action: DELETE the keys entirely (don't replace with strings).**

```diff
-<key>NSCameraUsageDescription</key>
-<string>Capture Video by user request</string>
-<key>NSMicrophoneUsageDescription</key>
-<string>Capture Audio by user request</string>
-<key>NSLocationWhenInUseUsageDescription</key>
-<string>Track current location by user request</string>
```

If at any future point Couch adds camera/photo-capture/location features, add the keys back with feature-specific copy (e.g., `"Couch attaches your photo to a watchparty memory."`).

## 5. UIBackgroundModes → keep `remote-notification`, drop `processing`

**Why:** `remote-notification` is needed for push (legitimate). `processing` is for BGTaskScheduler — Couch doesn't use it. App Review may ask why.

```diff
 <key>UIBackgroundModes</key>
 <array>
-  <string>processing</string>
   <string>remote-notification</string>
 </array>
```

## 6. Replace stub GoogleService-Info.plist — ✅ DOWNLOADED 2026-05-11

**Current state:** the PWABuilder-bundled file is a placeholder (BUNDLE_ID `com.microsoft.pwabuilder-ios`, all-zeros API keys). Firebase Auth + Cloud Messaging will silently fail without a real one.

**Done autonomously 2026-05-11:**
- Firebase iOS app registered: nickname `Couch Tonight iOS`, bundle ID `app.couchtonight.couch`, App ID `1:928451125383:ios:4ce434c2037bb93a1c1822`
- Real `GoogleService-Info.plist` downloaded via `firebase apps:sdkconfig` and saved to:
  - **`.planning/phases/17-app-store-launch-readiness/GoogleService-Info.plist`**

**Step you do:**
- In Xcode → Project navigator → drag the file from the path above into the project at `Couch Tonight/GoogleService-Info.plist` (replacing the stub) — when the dialog appears, check **Copy items if needed** and add to the Couch Tonight target.
- Skip the rest of Firebase's iOS SDK setup wizard (PWABuilder's wrapper doesn't use the iOS Firebase SDK directly — Firebase runs in the WKWebView via the existing js/firebase.js). The plist is just for APNs/FCM token registration at the native layer.

**Optional follow-up:** later, link this Firebase iOS app to the App Store Connect entry by setting App Store ID `6767413821` in Firebase Console → Project Settings → Your apps → Couch Tonight iOS → App Store ID field. Not required for TestFlight upload.

## 7. Sign in with Apple capability (gates submission)

**Why:** Source-side wiring shipped 2026-05-11 (commit `46c7013`). The Xcode-side capability flip is what completes the chain. Without it, App Store static analysis will reject the binary.

**Steps:**
- Xcode → Targets → Couch Tonight → **Signing & Capabilities** tab
- Click **+ Capability** (top-left of the tab)
- Search "Sign in with Apple" → double-click to add
- No further config needed — Apple wires the entitlement automatically

## 8. PrivacyInfo.xcprivacy

The drafted file lives at `.planning/phases/17-app-store-launch-readiness/PrivacyInfo.xcprivacy`. Drag-and-drop into the Xcode project at `Couch Tonight/PrivacyInfo.xcprivacy` (Project navigator → right-click "Couch Tonight" group → "Add Files to 'Couch Tonight'" → select the file → check "Copy items if needed" + Couch Tonight target).

## 9. Code signing (last step before Archive)

- Same Signing & Capabilities tab
- Check "Automatically manage signing"
- **Team:** select Nahder Zomorrodian (Team ID `49R296FJGF`)
- Xcode will pull the cert from your Apple Developer account automatically
- If you see "No matching provisioning profile" — wait 30 sec, then click "Try Again". Xcode auto-creates the profile for the bundle ID.

---

## Verification before Archive

Run a quick sanity check on the project's Info.plist with this terminal command:

```bash
plutil -p "Couch Tonight/Info.plist" | grep -E 'CFBundleIdentifier|LSApplicationCategoryType|NSCameraUsageDescription|NSMicrophoneUsageDescription|NSLocationWhenInUseUsageDescription|NSAllowsArbitraryLoads|UIBackgroundModes'
```

Expected:
- `CFBundleIdentifier => "app.couchtonight.couch"`
- `LSApplicationCategoryType => "public.app-category.entertainment"`
- NO output for the three permission descriptions (they should be absent)
- NO output for `NSAllowsArbitraryLoads` (absent)
- `UIBackgroundModes` shows only `remote-notification`

## Then: Archive + TestFlight

- Product → Destination → "Any iOS Device (arm64)"
- Product → Archive (~5-10 min)
- Window → Organizer → select the archive → Distribute App → App Store Connect → Upload
- TestFlight processes for ~30 min, then it's available for internal testers

---

*This doc is a working checklist — feel free to mark items off in-line, add notes, and save back. Won't auto-update.*
