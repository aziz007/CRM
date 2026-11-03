# Real Estate CRM

A lean CRM for real estate agents and managers, built for teams in the UAE and Pakistan. It manages leads, logs calls made through the phone's native dialer, tracks follow-ups, stores call recordings with AI assessment, and shows a manager dashboard.

> Status: Days 1 and 2 of the MVP plan are complete: authentication, roles, the app shell, and lead management. Calling, follow-ups, recordings, and the dashboard are next.

## Features (MVP)

- Lead management: create, edit, search, assign, and track status (New, Contacted, Qualified, Follow-up, Appointment, Won, Lost)
- SIM-based calling: click-to-call opens the native dialer; agents log outcome, notes, and duration
- Follow-ups: due dates, overdue lists, and a daily task view
- Recordings: secure upload to private storage, with validation of file type, size, and ownership
- AI assessment: transcript, outcome classification, summary, qualification, and recommended next action
- Manager dashboard: calls logged, recordings pending, qualified leads, appointments, overdue tasks, and agent activity
- Role-based access: Admin and Agent roles

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
| Recording storage | Private object storage (provider to be selected) |
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

Agents only see and change leads assigned to them. Admins see all leads and can reassign them.

## Project roadmap

1. Project setup and authentication (complete)
2. Lead management (complete)
3. Calling and call records
4. Follow-ups and tasks
5. Recording upload and AI assessment
6. Dashboard and agent performance
7. Testing, deployment, and handover

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
