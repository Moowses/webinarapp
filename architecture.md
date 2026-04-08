# WebinarAPP — Architecture (MVP)

## Overview
WebinarAPP delivers recorded webinars that feel live by:
- Scheduling “live-like” sessions per viewer timezone group
- Syncing playback time to session start time
- Syncing predefined chat to playback time
- Hosting realtime chat per session
- Using AI (ChatbotKit) to moderate/respond in chat
- Sending registration data to webhook/GHL

---

## Tech Stack
- Frontend: Next.js App Router, React, TypeScript, Tailwind
- Backend logic: Next.js Server Actions (`app/actions`)
- Data: Firebase Firestore
- AI: ChatbotKit
- Integrations: Webhook/GHL
- Video: stored in `/public`, referenced via Firestore metadata

---

## Firestore Data Model

### webinars/{webinarId}
Stores webinar metadata:
- title, slug
- videoPublicPath, durationSec
- schedule pattern (base timezone, days, times, live window)
- chatbotkit config (botApiKey, conversationId)
- webhook config (url, enabled)

### registrations/{registrationId}
Created during registration:
- webinarId
- user info (firstName, lastName, email, phone)
- userTimeZone, timezoneGroupKey
- scheduledStartISO, scheduledEndISO
- status (Registered/Attended/Expired)
- tokenHash (never store raw token)
- confirmationLinkDesktop/Mobile

### sessions/{sessionId}
Created only if someone attends:
- webinarId
- timezoneGroupKey
- scheduledStartISO, scheduledEndISO
- activeCount

### sessions/{sessionId}/messages/{messageId}
Realtime chat messages:
- type: user | ai | system | predefined
- text, senderName, senderId
- createdAt (serverTimestamp)
- playbackOffsetSec (optional, for predefined)

### webinars/{webinarId}/predefinedMessages/{messageId}
Predefined chat transcript:
- playbackOffsetSec
- senderName
- text

---

## Key Flows

### Registration → Confirmation
1) User registers at `/w/[slug]`
2) Server Action:
   - computes timezoneGroupKey
   - resolves scheduledStart/end
   - generates token (store tokenHash)
   - posts webhook payload to GHL
3) Redirect to `/confirm/[token]`

### Confirmation → Live
1) Validate token
2) If not started: show countdown
3) If live: allow join `/live/[token]`
4) If expired: redirect to registration

### Live Page
1) Validate token
2) Get or create session for:
   (webinarId + timezoneGroupKey + scheduledStartISO)
3) Compute playbackSec = now - scheduledStart
4) Play video from `/public`
5) Realtime chat via Firestore session messages
6) Predefined chat displayed based on playbackSec
7) AI replies (ChatbotKit) posted as ai messages

---

## Code Organization Rules

### Server Actions (`app/actions`)
All privileged operations:
- token generation + validation
- session create/lookup
- webinar CRUD (admin-only later)
- webhook calls
- AI calls
- predefined chat ingestion

### Services (`lib/services`)
External and reusable logic:
- Firebase Admin client (server-only)
- ChatbotKit client
- Webhook client
- Schedule/timezone utilities

### Client Components
- realtime chat subscription
- video player UI
- countdown UI
- forms and UX components

---

## Security Approach (MVP → Production)
MVP Dev:
- relaxed Firestore rules for quick testing
Production:
- lock writes behind server actions
- store only tokenHash
- enforce message validation + rate limits
- restrict admin routes via Firebase Auth + role claims

---

## Performance Notes
- Use session-level message streams
- Keep messages small
- Paginate predefined messages
- Avoid duplicating transcript per session
- Firestore can handle 20+ concurrent viewers with proper query patterns
