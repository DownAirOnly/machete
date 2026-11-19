# Machete account privacy and data security

## Current implementation (v3.0)

- Google sign-in is powered by Firebase Authentication. It shares the user's existing **Command** Firebase project (\`command-c8162\`) for identity only.
- Machete is inaccessible in the app UI until Firebase reports a verified signed-in account.
- Each Google UID gets a distinct local browser storage key (\`machete.v3.<uid>\`). Product photo blobs are also namespaced under that UID.
- Existing anonymous Machete v2 local history is **not** assigned automatically. The signed-in user explicitly chooses **Claim old device history** once. After confirmed save, the unscoped old local record is removed; legacy images are copied into the UID namespace when available.
- Signing out removes purchase data from in-memory app state and hides the views. It does NOT cryptographically erase previously persisted device storage.
- **Authentication is not encryption.** Device localStorage and IndexedDB remain accessible to someone with browser/device access and developer tools, even when the UI is signed out. Treat this as a login gate and account separation, **not** strong at-rest security.
- The app does **not** upload purchase history, photos, or backups to Firebase/Command. There is no Firestore access in v3.0. Data never syncs automatically between browsers.
- To achieve secure cloud sync, add user-scoped Firestore documents protected by deployed owner-only Firestore rules, plus versioning/conflict handling. Do not enable cloud writes until the rules are deployed and tested.
- Firebase Web App configuration keys are public identifiers, not administration credentials. Never upload a service account JSON, OAuth client secret, or a personal Amazon ZIP to GitHub.

## Firebase setup and operation

The existing Command Firebase project must have:
1. Google sign-in enabled under Authentication > Sign-in method (already in use by Command).
2. \`downaironly.github.io\` under Authentication > Settings > Authorized domains.
3. A working network connection for first sign-in.
4. Popups permitted for Machete (on some installed iPhone PWAs, open the URL in Safari to sign in).

All private purchasing information is imported after sign-in. Existing v2 data can be claimed manually.

## Threat model limitations
- Sign-in prevents accidental cross-account display in the UI, not extraction by same-device privileged users or browser extensions.
- Shared devices should be protected with a device passcode and locked user profile.
- Cloud backups are NOT available, so users must export their own ZIP backups to prevent data loss.
- A future version should support server-validated, owner-only Firestore storage and optionally client-side encryption with a separate passphrase if at-rest confidentiality is required.
