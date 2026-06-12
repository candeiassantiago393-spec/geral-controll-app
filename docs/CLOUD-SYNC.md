# Cloud sync setup (PC + phone)

Sync uses **Firebase** (free tier). One email account = same data on all devices.

## 1. Create Firebase project

1. https://console.firebase.google.com/ → **Add project**
2. **Authentication** → Sign-in method → enable **Email/Password**
3. **Firestore Database** → Create database (production mode is OK)

## 2. Firestore security rules

Firestore → Rules → paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 3. Web app config

Project settings → Your apps → **Web** `</>` → register app → copy the `firebaseConfig` object.

## 4. In Candeias app

**Settings → Cloud sync** → paste JSON → Save → reload → **Create account** with your email.

On phone: same email + password → data downloads automatically.

## 5. Authorized domains

Firebase → Authentication → Settings → Authorized domains → add:

- `candeiassantiago393-spec.github.io`
- `localhost` (for local testing)

## App updates

**Settings → Update app** or use the green banner when a new version is deployed. No reinstall needed.
