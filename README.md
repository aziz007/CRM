# Real Estate CRM

A lean CRM for real estate agents and managers, built for teams in the UAE and Pakistan. It manages leads, logs calls made through the phone's native dialer, tracks follow-ups, stores call recordings with AI assessment, and shows a manager dashboard.

> Status: early development. The first milestone is a working MVP with authentication, lead management, call logging, follow-ups, recordings, AI assessment, and a dashboard.

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

Setup instructions will be added once the Day 1 foundation (project structure, database connection, and authentication) is in place.

```bash
# Planned
git clone https://github.com/aziz007/CRM.git
cd CRM
```

Environment variables will be documented in `.env.example`. Do not commit real secrets.

## Project roadmap

1. Project setup and authentication
2. Lead management
3. Calling and call records
4. Follow-ups and tasks
5. Recording upload and AI assessment
6. Dashboard and agent performance
7. Testing, deployment, and handover

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
