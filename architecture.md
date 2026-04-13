# WebinarAPP Architecture

## Overview

WebinarAPP is a recorded-webinar platform that simulates a live experience.

Core behavior:
- registrations are tied to a scheduled webinar occurrence in the attendee's timezone
- confirmation pages show the attendee's scheduled webinar
- live playback starts at the current offset from scheduled start
- predefined chat replays against playback time
- admins monitor sessions, registrants, and attendance
- external systems receive registration and attendance outcomes through webhooks

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Firebase Firestore
- Firebase Admin SDK
- ChatbotKit
- `nginx` for production proxy/static upload serving

## Application structure

### App routes
- `app/w/[slug]` - public registration flow
- `app/confirm/[token]` - confirmation page
- `app/live/[token]` - live webinar room
- `app/admin/...` - admin surfaces
- `app/api/...` - uploads, live presence, chat, webhook tests, background-style processing endpoints

### Server actions
Server Actions in `app/actions` handle:
- webinar CRUD
- registration creation
- token lookup
- session creation
- admin registration/webinar queries

### Shared services
`lib/services` contains reusable server-side logic for:
- Firebase Admin access
- webhook payload building and delivery
- attendance/no-show webhook processing
- admin live overview aggregation

## Data model

### `webinars/{webinarId}`
Stores webinar configuration.

Key fields:
- `title`
- `slug`
- `videoPublicPath`
- `durationSec`
- `lateGraceMinutes`
- `schedule`
  - `timezoneBase`
  - `daysOfWeek`
  - `times`
  - `dayTimes`
  - `liveWindowMinutes`
- `webhook`
  - registration webhook
- `attendanceWebhook`
  - attendance/no-show webhook
- `redirect`
- `bot`
- `registrationPage`
- `confirmationPage`

### `registrations/{registrationId}`
Created when someone registers.

Key fields:
- webinar identity
- registrant identity
- `token`
- `tokenHash`
- `userTimeZone`
- `timezoneGroupKey`
- `scheduledStartISO`
- `scheduledEndISO`
- `liveWindowEndISO`
- `status`
  - `Registered`
  - `Attended`
  - `No-show`
- `attendedLive`
- `attendedAtISO`
- live watch state
- webhook delivery guards
  - `attendanceWebhookSentAtISO`
  - `attendanceWebhookClaimedAtISO`
  - `noShowWebhookSentAtISO`
  - `noShowWebhookClaimedAtISO`

### `sessions/{sessionId}`
Session-level chat/session grouping for attendee rooms.

### `sessions/{sessionId}/messages/{messageId}`
Realtime and predefined chat entries.

### `liveSessions/{sessionId}`
Admin-facing active live-session index.

Key fields:
- webinar metadata
- scheduled start
- live window end
- last seen timestamps

### `liveSessions/{sessionId}/viewers/{registrationId}`
Current active viewer index for admin monitoring.

Key fields:
- viewer identity
- last seen timestamps
- watched minutes

### `webinars/{webinarId}/predefinedMessages/{messageId}`
Predefined chat transcript.

Key fields:
- `playbackOffsetSec`
- `senderName`
- `text`

## Scheduling model

The webinar editor supports per-day times:
- example: Wednesday 20:00
- example: Thursday 18:00

On registration:
1. the attendee's timezone is read from the browser
2. the next matching scheduled occurrence is computed in that timezone
3. the registration stores concrete `scheduledStartISO`, `scheduledEndISO`, and `liveWindowEndISO`

This means:
- attendee access logic is based on their personal scheduled occurrence
- admin reporting can group registrations by webinar + scheduled start

## Registration flow

1. User opens `/w/[slug]`
2. Registration form submits through `registerForWebinarAction`
3. System computes the attendee's next valid occurrence
4. Registration record is created with token and schedule snapshot
5. Registration webhook is sent
6. User is redirected to `/confirm/[token]`

## Confirmation flow

The confirmation page:
- validates the token
- shows schedule/countdown information
- supports uploaded/self-hosted media
- supports YouTube/Vimeo embeds
- can auto-play media where allowed by the browser

## Live flow

1. User opens `/live/[token]`
2. Token is validated
3. Access is rejected if:
   - webinar has not started yet
   - late join grace has already passed and they never attended
   - session is over
4. Session is created or reused
5. Playback offset is calculated from `scheduledStartISO`
6. Live room renders video + chat

## Attendance model

### Attended
A registrant becomes attended when they successfully enter the live webinar flow.

This updates:
- `attendedLive = true`
- `attendedAtISO`
- `status = "Attended"`

The attendance webhook is then sent once.

### No-show
A registrant becomes a no-show when:
- `status` is still `Registered`
- they never attended
- current time is later than:
  - `scheduledStartISO + lateGraceMinutes`

At that point:
- `status` becomes `No-show`
- the same attendance webhook URL receives:
  - `eventType: "attendance"`
  - `attendanceStatus: "No-show"`

No-show processing currently happens through:
- a reusable processing service
- `/api/admin/process-no-show-webhooks`
- an opportunistic run when `/admin` loads

## Webhook model

### Registration webhook
Configured in webinar settings under `Webhook`.

Payload intent:
- notify external systems that someone registered

Important fields:
- `eventType: "registration"`
- `attendanceStatus: "Registered"`
- registrant identity
- webinar time
- confirmation link
- live link

### Attendance webhook
Configured separately in webinar settings under `Attendance Webhook`.

Uses one URL for both outcomes:
- `attendanceStatus: "Attended"`
- `attendanceStatus: "No-show"`

This makes GHL/Zapier branching straightforward.

## Admin architecture

### Dashboard
`/admin` renders:
- dashboard
- scheduled webinars
- activity log
- live monitor
- webinars list
- registrants list
- settings

### Scheduled Webinars
Built from:
- real upcoming registration sessions first
- webinar schedule fallback if there are no registrations yet

### Activity Log
Built by grouping registrations by:
- `webinarId`
- `scheduledStartISO`

Shows:
- status
- registrants
- attended count
- no-show count
- drill-down attendee details

### Live Monitor
Uses the `liveSessions` and `liveSessions/viewers` index rather than scanning all registrations.

## Upload/storage model

Uploaded assets are stored locally under:
- `public/uploads/webinars/...`
- `public/uploads/site/...`

In production:
- `nginx` should serve `/uploads/` directly from disk
- Next handles the application routes

This is correct for the current single-Droplet deployment model, but object storage/CDN is the future scaling path for video delivery.

## Performance notes

- live monitor avoids full registration scans for active viewer detection
- predefined chat fetching is windowed to reduce repeated reads
- registrant/admin lists are limited rather than loading entire collections
- local MP4 delivery is still the main bandwidth bottleneck at scale

## Reliability notes

- attendance and no-show webhook sends use claimed/sent guards to avoid duplicate delivery
- uploaded local files require correct filesystem permissions
- production should set both:
  - `BASE_URL`
  - `NEXT_PUBLIC_BASE_URL`

## Current deployment assumption

The app is designed for:
- one Droplet
- one Next.js runtime
- local uploads in `public/uploads`
- `nginx` reverse proxy in front

That is stable for the current stage, with object storage/CDN as the next architectural step when video traffic grows.
