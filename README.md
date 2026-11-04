# Real Estate CRM

A lean CRM for real estate agents and managers, built for teams in the UAE and Pakistan. It manages leads, logs calls made through the phone's native dialer, tracks follow-ups, stores call recordings with AI assessment, and shows a manager dashboard.

> Status: Days 1 to 4 are complete. Day 5 is partly done: recording storage and the upload screen are in place. AI assessment is next. Appointment and property endpoints are available; their screens are not yet built.

## Features (MVP)

- Lead management: create, edit, search, assign, and track status (New, Contacted, Qualified, Follow-up, Appointment, Won, Lost)
- SIM-based calling: click-to-call opens the native dialer; agents log outcome, notes, and duration
- Follow-ups: due dates, overdue lists, and a daily task view
- Recordings: secure upload to private storage, with validation of file type, size, and ownership
- AI assessment: transcript, outcome classification, summary, qualification, and recommended next action
- Manager dashboard: calls logged, recordings pending, qualified leads, appointments, overdue tasks, and agent activity
- Role-based access: Admin and Agent roles

## Calling workflow

1. Agent taps **Call** on a lead. The app records a pending call and opens the phone's dialer.
2. After the call, the agent logs the outcome, duration and notes (**Log outcome**).
3. Optionally, the agent pastes the phone's call log into **Calls → Import**. Matching calls are marked verified, which lets managers see which logged calls the device confirms.

## Call recordings

Recordings are stored in a private Backblaze B2 bucket through its S3-compatible API. The database keeps only metadata. Audio never passes through the database.

Upload flow:

1. The agent requests an upload. The server checks the call, the file type and size, and that consent was confirmed. It then returns a signed upload link that expires after 10 minutes.
2. The app uploads the file directly to B2 with that link.
3. The app confirms the upload. The server checks that the file size and type match what was declared.
4. Downloads use a separate signed link that expires after 5 minutes.

Set up B2:

1. Create a B2 account and a bucket. Keep the bucket **Private**.
2. Create an application key limited to that bucket.
3. Copy the endpoint, region, bucket name, key ID and application key into `backend/.env`. See `backend/.env.example`.

Storage keys are generated on the server, so uploaded file names cannot change where a file is stored.

Browsers upload directly to B2, so the bucket needs a CORS rule. In the bucket settings, allow the app's origin (for example `http://localhost:4200` and your deployed site) with the `PUT`, `GET` and `HEAD` operations and all headers.

## Deployment (free to start)

Recommended setup: MongoDB Atlas (free cluster) for the database, Render (free web service) for the API, and Netlify (free) for the frontend.

Note: Render's free web service sleeps after 15 minutes without traffic. The first request after a sleep takes about a minute. This is fine for testing and a small pilot. Upgrade the API service when agents depend on it during the day.

1. **MongoDB Atlas:** create a free M0 cluster, add a database user, and copy the connection string. Under Network Access, allow connections from anywhere for now, and tighten this later.
2. **API on Render:** New, Web Service, connect the GitHub repo.
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
   - Environment variables: the values from `backend/.env`, plus `NODE_ENV=production` and `CORS_ORIGIN=https://<your-netlify-site>.netlify.app`
3. **Create the first admin** from your computer, using the production `MONGODB_URI`: run `ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... ADMIN_COUNTRY=AE node src/utils/createAdmin.js` inside `backend`.
4. **Frontend on Netlify:** set the API address in `frontend/src/environments/environment.production.ts` to `https://<your-render-service>.onrender.com/api/v1`, commit it, then on Netlify choose New site from Git. The base directory is `frontend`. Netlify reads `netlify.toml` for the build settings.
5. **Backblaze:** add the Netlify site address to the bucket's CORS rule, as described in the Call recordings section.

## Follow-ups

Tasks have a due date and time, an optional lead, and an assignee. The dashboard shows overdue and due-today counts. Due dates are computed in the user's own timezone, so "today" matches the clock on their device. Completing a lead's task is recorded in the lead's activity history.

## Important limitation

Calls are placed through the agent's phone dialer. The CRM cannot guarantee automatic recording of cellular calls or complete call-log sync across iPhone and Android. Recording uploads and call-log verification are the fallback workflow.

## Consent and compliance

Recording a call without the consent of all participants can be a criminal offence in the UAE. The app therefore requires agents to confirm that the client has been told the call is recorded and has agreed before a recording can be uploaded. The consent timestamp and the agent's ID are stored with each recording.

Before going live, confirm your obligations under UAE PDPL and Pakistan's data protection and cybercrime laws with a qualified lawyer. Audio and transcripts are treated as sensitive personal data, and cross-border transfers to third-party AI and transcription providers must be reviewed.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular, Angular Material |
| Backend | Node.js, Express, JWT authentication |
| Database | MongoDB (Atlas) |
| Recording storage | Backblaze B2, private bucket via S3-compatible API |
| Transcription | AssemblyAI (planned) |
| AI assessment | Claude via the Anthropic API (planned) |

Audio files are never stored in MongoDB. Only their metadata and storage keys are saved there.

## Getting started

Requirements: Node.js 20 or later, and a MongoDB database (MongoDB Atlas free tier is enough for development).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET
npm run dev              # API on http://localhost:4000
```

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the first admin account (values come from your `.env` or the shell):

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='use-a-long-password' ADMIN_NAME='Your Name' ADMIN_COUNTRY=AE \
  node src/utils/createAdmin.js
```

Run tests with `npm test`.

### 2. Frontend

```bash
cd frontend
npm install
npm start                # http://localhost:4200
```

Sign in with the admin account you created.

### API so far

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/login` | Sign in, returns a JWT |
| GET | `/api/v1/auth/me` | Current user (requires `Authorization: Bearer <token>`) |
| GET | `/api/v1/leads` | List leads with search, status, country, source, and paging filters |
| POST | `/api/v1/leads` | Create a lead (duplicate phone in the same country is rejected) |
| GET | `/api/v1/leads/:id` | Lead details |
| PATCH | `/api/v1/leads/:id` | Update a lead; status and assignment changes are logged |
| DELETE | `/api/v1/leads/:id` | Archive a lead (admin only) |
| GET | `/api/v1/leads/:id/activities` | Activity history for a lead |
| POST | `/api/v1/leads/:id/activities` | Add a note to a lead |
| GET | `/api/v1/users` | Active users for assignment (admin sees contact details) |
| GET | `/api/v1/calls` | List calls, filtered by status, verification, lead or agent |
| POST | `/api/v1/calls/start` | Start click-to-call: records a pending call and returns the number to dial |
| POST | `/api/v1/calls` | Log a call manually; calls close in time to an earlier one are flagged as possible duplicates |
| PATCH | `/api/v1/calls/:id` | Log or correct the outcome, duration and notes |
| POST | `/api/v1/calls/import` | Import phone call-log entries; matches them to the agent's leads and marks them verified |
| POST | `/api/v1/recordings/upload-url` | Start an upload. Requires consent to be confirmed. Returns a 10-minute signed upload link |
| POST | `/api/v1/recordings/:id/complete` | Confirm the upload arrived with the declared size and type |
| GET | `/api/v1/recordings?callId=` | List recordings for a call |
| GET | `/api/v1/recordings/:id` | Recording metadata |
| GET | `/api/v1/recordings/:id/download` | 5-minute signed download link |
| GET | `/api/v1/appointments` | List appointments, filtered by lead, agent, status, or date range |
| POST | `/api/v1/appointments` | Book an appointment for a lead, optionally with a property |
| PATCH | `/api/v1/appointments/:id` | Change status (Scheduled, Completed, Cancelled, No Show), time, location or notes |
| GET | `/api/v1/properties` | Browse property listings |
| POST | `/api/v1/properties` | Add a listing (admin only) |
| PATCH | `/api/v1/properties/:id` | Update a listing (admin only) |
| GET | `/api/v1/tasks` | List tasks by bucket (overdue, today, upcoming), status, lead or assignee |
| GET | `/api/v1/tasks/summary` | Counts of overdue, due-today and due-in-7-days tasks for the dashboard |
| POST | `/api/v1/tasks` | Create a follow-up task, optionally linked to a lead |
| PATCH | `/api/v1/tasks/:id` | Edit a task, or mark it done, open or cancelled |
| DELETE | `/api/v1/tasks/:id` | Delete a task (admin only) |

Agents only see and change leads assigned to them. Admins see all leads and can reassign them.

## Project roadmap

1. Project setup and authentication (complete)
2. Lead management (complete)
3. Calling and call records (complete)
4. Follow-ups and tasks (complete)
5. Recording upload and AI assessment
6. Dashboard and agent performance
7. Testing, deployment, and handover

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
