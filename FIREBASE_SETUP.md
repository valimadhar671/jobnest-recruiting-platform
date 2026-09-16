# Firebase production setup

1. Create a Firebase Web App and copy its public configuration into `.env.local`
   using `.env.example` (never commit `.env.local`).
2. Enable Email/Password, Google, and GitHub providers in **Authentication**.
3. Create a Firestore database and deploy rules that require `request.auth != null`.
   Restrict users to their own profile and recruiters to their own jobs; protect
   applications and reminders by their candidate/recruiter relationships. Set a
   custom `admin` claim on the platform owner Firebase UID for approval actions
   and owner-wide reads.
4. Candidate resumes and intro videos are stored as shareable HTTPS links
   (Google Drive, Dropbox, YouTube, or another trusted host). Firebase Storage
   is optional and is not required for the free-tier deployment.
5. Add the production app domain to Authentication authorized domains.
6. From this directory, run `firebase deploy --only firestore:rules,firestore:indexes`
   after installing/authenticating the Firebase CLI and selecting the intended
   project (`firebase use <project-id>`).

JobNest no longer stores passwords, sessions, or files in the Next.js filesystem,
JSON files, or browser `localStorage`. OAuth is handled by Firebase Auth.

The client hydrates Firestore only after Firebase Auth is ready. User reads are
scoped to the signed-in profile, application reads to the candidate/recruiter,
and reminder reads to the signed-in recipient. Jobs are publicly readable.

## 2k–5k user launch checklist

- Enable and enforce **App Check** (reCAPTCHA Enterprise or your selected web
  provider) for Firestore and Auth after testing the production domain.
- Deploy both `firestore.rules` and `firestore.indexes.json`; verify composite
  indexes are `READY` before launch.
- Configure Authentication email-enumeration protection, authorized domains,
  provider quotas, and abuse monitoring.
- Set Firestore budgets and alerts, review usage weekly, and configure an
  incident contact. Client limits reduce reads but are not a rate-limit or
  DDoS guarantee.
- Deploy the Next.js app on a supported host with production
  `NEXT_PUBLIC_FIREBASE_*` variables, HTTPS, CDN caching, and a rollback build.
- Exercise sign-up, recruiter approval, job posting, applications, and reminders
  against the production project before opening registration.

## Capacity contingency: next 5k users

Firebase Authentication can continue holding the additional users without a
separate application deployment. Firestore scales by usage, not by an
application-defined user ceiling. Start on the free tier with quota alerts,
then review billing before increasing traffic.

When any alert reaches 70% of its configured daily quota, review the Firebase
usage dashboard and reduce expensive reads first. At 85%, temporarily disable
non-essential reminder processing. At 95%, enable a maintenance banner for new
registrations while existing users can continue reading their accounts and
applications. Never silently report a successful write when Firebase rejects it.

For the next 5,000 users:

- Keep jobs and applications paginated and query-scoped; do not replace the
  bounded queries/listeners with whole-collection reads.
- Increase Firebase quotas or billing limits before the alert reaches 100%.
- If private file storage is later required, add a trusted file service only
  after confirming that the additional billing is acceptable.
- Export Firestore backups and test a restore procedure before increasing
  registration traffic.
- Use Firebase Performance/Crashlytics or equivalent monitoring to watch
  latency, failed writes, and authentication errors.
- Load-test the production project with synthetic accounts before opening the
  extra capacity.

These actions are operational controls, not automatic failover. Firebase
Console billing, quotas, backups, monitoring, and any maintenance-mode switch
must be configured and operated by the project owner.
