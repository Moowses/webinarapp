# Webinar App

A Next.js webinar platform with registration, confirmation links, live-room playback, synced chat, and an admin area for managing webinars.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Firebase / Firestore

## Main Routes

- `/w/[slug]` - webinar registration page
- `/confirm/[token]` - confirmation and countdown flow
- `/live/[token]` - live webinar room
- `/admin` - webinar admin dashboard
- `/live-test` - local test page for chat/live behavior

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create or update `.env.local`.

Required variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_BASE_URL=
BASE_URL=
```

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- Firebase Admin credentials are required for server-side actions.
- Webinar assets such as video files can be served from `public/`.
- The current landing page at `app/page.tsx` is still the default starter page and can be replaced with your own homepage.
