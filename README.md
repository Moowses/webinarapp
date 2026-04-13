# WebinarAPP

WebinarAPP is a self-hosted webinar platform built with Next.js, TypeScript, Tailwind, and Firestore. It supports webinar registration, confirmation pages, a live webinar room, predefined chat replay, admin monitoring, and webhook delivery for registration and attendance outcomes.

## What it does

- Webinar registration pages per webinar slug
- Confirmation pages with countdown, media, and CTA controls
- Live webinar playback that follows scheduled time
- Predefined chat replay synced to playback time
- Admin dashboard for webinars, registrants, live monitor, scheduled webinars, and activity log
- Registration webhook delivery
- Attendance webhook delivery for:
  - `Attended`
  - `No-show`
- Local video and asset uploads stored in `public/uploads`

## Main routes

- `/admin` - main admin dashboard
- `/admin/webinars/new` - create webinar
- `/admin/webinars/[webinarId]` - edit webinar
- `/admin/webinars/[webinarId]/registration-page` - edit registration page
- `/admin/webinars/[webinarId]/confirmation-page` - edit confirmation page
- `/admin/webinars/[webinarId]/preview` - admin webinar QA preview
- `/w/[slug]` - public webinar registration page
- `/confirm/[token]` - confirmation / countdown page
- `/live/[token]` - live webinar room
- `/confirm-preview/[slug]` - admin-safe confirmation preview

## Core features

### Webinar editor
Each webinar can be configured with:
- title and slug
- uploaded video
- duration
- late join grace
- per-day schedule times
- live window
- redirect after webinar
- AI bot settings
- registration webhook
- attendance webhook

### Scheduling
Scheduling is based on the attendee's own timezone for registration and access logic.

Example:
- Wednesday at 8:00 PM
- Thursday at 6:00 PM

The admin dashboard displays scheduled webinar times in the moderator timezone view used by the dashboard.

### Registration page editor
Each webinar has a customizable registration page with editable:
- eyebrow
- heading
- description
- CTA labels
- modal heading
- submit button
- disclaimer
- phone incentive copy
- arrow/bonus assets
- color controls

### Confirmation page editor
Each webinar also has a customizable confirmation page with:
- headline
- step banner
- intro copy
- schedule/countdown labels
- join button
- add-to-calendar label
- messenger button
- uploaded media or external YouTube/Vimeo media
- layout positioning
- color controls

### Live webinar room
The live page:
- validates token access
- calculates playback position based on scheduled start
- supports predefined chat replay
- tracks viewer presence
- marks attendees as attended
- updates live monitor data for admins

### Predefined chat
Predefined chat supports:
- TXT upload
- CSV upload

It is replayed against playback time to simulate webinar chat during live playback.

### Admin dashboard
The admin dashboard includes:
- dashboard view
- scheduled webinars
- activity log
- live monitor
- webinars list
- registrants list
- settings

### Activity log
Activity Log shows:
- webinar
- scheduled/start/completed timestamps
- status
- registrants
- attended count
- no-show count

Drill-down rows include:
- name
- email
- status
- duration attended
- confirmation/live link copy buttons for still-registered attendees

### Webhooks

#### Registration webhook
Sent when someone successfully registers.

Includes:
- `eventType: "registration"`
- `attendanceStatus: "Registered"`
- registrant identity
- webinar time
- confirmation link
- live link

#### Attendance webhook
Sent to the separate webinar attendance webhook URL.

Attended:
- sent automatically when the registrant first joins the live webinar
- `eventType: "attendance"`
- `attendanceStatus: "Attended"`

No-show:
- sent automatically after the registrant's late-join grace period has passed
- only sent if they never attended
- `eventType: "attendance"`
- `attendanceStatus: "No-show"`

Both use the same attendance webhook URL so GHL/Zapier can branch on `attendanceStatus`.

## Environment variables

Create `.env.local` with the required Firebase and app values:

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
NEXT_PUBLIC_BASE_URL=http://localhost:3000
BASE_URL=http://localhost:3000
```

For production, set:

```env
NEXT_PUBLIC_BASE_URL=https://live.onlinebroadcastpro.com
BASE_URL=https://live.onlinebroadcastpro.com
```

## Local development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

## Production notes

- Uploaded files are stored in `public/uploads`
- On a single Droplet, `nginx` should serve `/uploads/` directly from disk
- Large video uploads require `client_max_body_size` to be increased in `nginx`
- File permissions for uploaded assets should allow the web server to read them
- The app currently fits a single-server deployment model; object storage/CDN is the next scaling step for video

## Current operational model

- Registration creates a registration record and sends the registration webhook
- Joining the live room marks the registrant as attended and sends the attendance webhook once
- No-show webhooks are processed after late-join grace has passed and the registrant still has not attended
- `/admin` opportunistically processes due no-show webhooks, and there is also a dedicated processing route:
  - `/api/admin/process-no-show-webhooks`
