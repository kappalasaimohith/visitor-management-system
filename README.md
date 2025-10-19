## Push Notifications Setup

1. Create a Firebase project and enable Cloud Messaging.
2. Replace all `YOUR_API_KEY`, `YOUR_AUTH_DOMAIN`, `YOUR_PROJECT_ID`, `YOUR_MESSAGING_SENDER_ID`, `YOUR_APP_ID`, and `YOUR_VAPID_KEY` in:
  - `frontend/src/firebase.js`
  - `frontend/public/firebase-messaging-sw.js`
  - `frontend/src/App.jsx` (VAPID key)
3. Set `FCM_SERVER_KEY` in backend env to your Firebase Cloud Messaging server key.
4. On first login, browser will request notification permission and register for push.
5. Pushes are sent to topics: `household_{householdId}` and `guards`.
# Visitor Management System — README (MVP)

Summary
-------
This repository implements a MyGate-style gated community system MVP using Supabase (Auth + Postgres) and a small Node/Express backend. Core features implemented:

- Authentication via Supabase Auth (server validates access tokens using service role client)
- RBAC via `users.roles` (text[]): resident, guard, admin
- Visitor lifecycle: pending → approved/denied → checked_in → checked_out
- Append-only `events` table for audit
- AI Copilot (server-side) that can parse natural language into structured actions and execute them (backend chat endpoint uses Gemini wrapper)
- Push notifications via FCM (simple helper; set `FCM_SERVER_KEY` env var to enable)

What I changed/added
- Frontend `VisitorForm.jsx` calls backend `/api/visitors/create` to centralize validation and notifications.
- `backend/notify.js` added to send FCM pushes to topics/tokens.
- `backend/seed.js` script to create demo household/users/visitor.
- `backend/postman_collection.json` with sample requests to main API endpoints.

Architecture (90-second)
------------------------
Client (React) authenticates using Supabase Auth and holds an access token. Client calls the backend APIs under `/api/*` with Authorization: Bearer <access_token>. Backend `authMiddleware` verifies the token using the Supabase admin client, attaches a normalized `req.profile`, then routes validate role and visitor state transitions. Backend writes to `visitors` and `events` tables (append-only) and sends push notifications via FCM.

RBAC (who can do what)
- resident: create visitor for their household; approve/deny visitors for their own household
- guard: view approved visitors; check-in and check-out visitors
- admin: manage any visitor (approve/deny)

AI tools (server-side helpers)
- The chat endpoint accepts a message and returns structured JSON indicating an action.
- Implemented actions (names + args):
  - approve_visitor(visitorId: string)
  - deny_visitor(visitorId: string, reason?: string)
  - checkin_visitor(visitorId: string)

Notifications mapping
- visitor.created -> topics: `household_{householdId}`, `guards`
- visitor.approved/denied -> same topics
- visitor.checked_in / checked_out -> same topics

Environment variables
- SUPABASE_API_URL — your Supabase URL
- SUPABASE_API_SERVICE_ROLE_KEY — Supabase service_role key (server)
- GEMINI_API_KEY — (optional) for Gemini AI calls
- GEMINI_MODEL — optional model name
- FCM_SERVER_KEY — (optional) legacy FCM server key for quick notifications (production: use service account OAuth)

Seed and run (backend)
1. Ensure environment variables are set (at minimum SUPABASE_API_URL and SUPABASE_API_SERVICE_ROLE_KEY).
2. Seed DB (creates household, demo users rows, visitor):

```powershell
cd backend
node seed.js
```

3. Start server:

```powershell
cd backend
npm run dev
```

Notes & next steps
- The project uses Supabase rather than Firebase as an equivalent backend (server validates tokens and enforces RBAC). If you need a Firebase migration, I can provide a migration plan.
- For production notifications use FCM HTTP v1 with OAuth2 service-account credentials (the current helper supports legacy server key for demos).
- I can now implement frontend resident/guard lists, audit UI, and tighten the AI Copilot validations and tooling flow (function-calling with structured outputs). 
