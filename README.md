# JobNest

JobNest is a recruiter-first job board for private recruiting workflows. It
lets approved recruiters publish openings and lets candidates create profiles,
share professional links, submit applications, and track application status.

## Features

- Firebase Authentication with email/password, Google, and GitHub sign-in.
- Candidate and recruiter roles with recruiter approval workflow.
- Public job browsing with search, location, role, and status filtering.
- Recruiter job creation and application review.
- Candidate dashboards with profile information and application metrics.
- Application status workflow: new, reviewing, shortlisted, and rejected.
- Firestore persistence with scoped realtime listeners and bounded queries.
- Firestore security rules and composite indexes included in the repository.
- Browser-side expiry automation closes notices after `expiresAt` and creates
  in-app notices for the recruiter and applicants while retaining application
  history.
- A protected `/api/automation` endpoint can run independently on an hourly
  scheduler (the included Vercel Cron configuration) for reliable expiry
  closure and reminder creation when no browser is open.
- Resume and intro-video links instead of binary uploads, avoiding Storage
  charges and allowing candidates to use Google Drive, Dropbox, YouTube, or
  another trusted HTTPS host.
- In-app reminders and realtime dashboard updates.

## Technology

- Next.js 16 and React 19
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Tailwind CSS

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project with Authentication and Firestore enabled

Firebase Storage is not required by the current link-based attachment flow.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the `NEXT_PUBLIC_FIREBASE_*` values from Firebase Console:

   Firebase Console > Project settings > Your apps > Web app

4. Enable these Authentication providers:

   - Email/password
   - Google
   - GitHub

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

Never commit `.env.local`. Firebase web configuration values are intended for
client use, but service-account keys, OAuth secrets, SMTP passwords, and API
tokens must never be placed in browser code or committed to the repository.

## Firebase deployment

Authenticate the Firebase CLI and select the project:

```bash
npx firebase-tools login
npx firebase-tools use <firebase-project-id>
```

Deploy Firestore rules and indexes:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

The repository includes:

- `firestore.rules` for access control and data validation.
- `firestore.indexes.json` for realtime query indexes.
- `firebase.json` for Firebase CLI configuration.
- `FIREBASE_SETUP.md` for production setup, scaling, monitoring, and
  contingency guidance.

## Application workflow

### Candidates

1. Register as a candidate.
2. Sign in with Firebase Authentication.
3. Add optional HTTPS links for a resume and intro video.
4. Browse open jobs and submit an application.
5. Track application status from the dashboard.

### Recruiters

1. Register as a recruiter with company and phone details.
2. Wait for owner approval.
3. Create and manage job openings after approval.
4. Review related applications and update their statuses.

### Owner administration

Owner-only operations use the Firebase custom claim `admin == true`. Set this
claim with a trusted server-side administrative process; never expose a
service-account key in the browser.

## Validation

Run the checks used before publishing:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

The project does not include fake production credentials or demo passwords.
All live Firebase behavior should be tested in the target Firebase project
after deployment, including authentication, recruiter approval, job creation,
applications, status updates, and realtime synchronization in two browsers.
The background automation endpoint additionally requires the deployment-only
`FIREBASE_SERVICE_ACCOUNT_JSON` and `CRON_SECRET` variables from `.env.example`.

## Security and privacy notes

- Firestore rules scope user, application, reminder, and recruiter data.
- Use HTTPS links with sharing permissions appropriate for recruiter review.
- External file-host permissions are not controlled by JobNest.
- Do not place sensitive documents on public links unless the candidate
  accepts that risk.
- Enable Firebase App Check and quota/budget alerts before public launch.
- Real email and SMS delivery requires a separately configured provider.

## Project structure

```text
src/app/                  Next.js routes and page UI
src/components/           Shared auth, branding, and reminder components
src/lib/firebase-client.ts Firebase initialization and Firestore access
src/lib/jobnest-data.ts   Domain models, validation, persistence, realtime state
firestore.rules            Firestore authorization rules
firestore.indexes.json     Firestore composite indexes
FIREBASE_SETUP.md          Deployment and operations guide
```

## License

This project is currently private and does not declare an open-source license.
