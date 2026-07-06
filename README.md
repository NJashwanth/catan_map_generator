# Catan Map Generator (Firebase + Google Ads)

A static web app that generates random Catan-style maps (3-4-5-4-3 layout), with optional fairness checks to avoid adjacent `6` and `8` number tokens.

## Features

- Random board generation for classic 19 hexes
- Optional seeded generation (repeatable maps)
- Fairness toggle to reduce high-probability token clustering
- Mobile-friendly responsive UI
- Firebase Hosting ready
- Google AdSense ad slot placeholder included

## Project Structure

- `index.html` - app markup and AdSense placeholder
- `styles.css` - visual design and responsive layout
- `script.js` - map generation logic and rendering
- `firebase.json` - Firebase hosting configuration
- `.firebaserc` - Firebase project alias mapping

## Run Locally

Because this is a static app, you can open `index.html` directly.

For closer parity with hosting:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Login:
   ```bash
   firebase login
   ```
3. Start local hosting preview:
   ```bash
   firebase emulators:start --only hosting
   ```
4. Open the printed local URL.

## Deploy to Firebase Hosting

1. Create a Firebase project in Firebase Console.
2. Update `.firebaserc` with your project id:
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```
3. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

## Enable Google AdSense

1. Sign in to AdSense and add your Firebase hosting domain.
2. In `index.html`, replace all `ca-pub-XXXXXXXXXXXXXXXX` values with your actual publisher id.
3. Replace `data-ad-slot="1234567890"` with your ad slot id.
4. Redeploy to Firebase.
5. After AdSense approval, ads should render on production domain.

## Notes

- AdSense typically does not serve real ads on localhost.
- Your site must comply with AdSense policies and may need enough content/traffic for approval.
- This app is a fan utility and not an official Catan product.
