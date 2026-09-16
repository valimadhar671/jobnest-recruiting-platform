export type UserRole = "candidate" | "recruiter";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  linkedIn?: string;
  github?: string;
  location?: string;
  phone?: string;
  companyName?: string;
  resume?: string;
  introVideo?: string;
  profileSummary?: string;
  approved?: boolean;
  status?: "active" | "pending" | "rejected";
  createdAt: string;
};

export type Job = {
  id: string;
  recruiterId: string;
  recruiterName: string;
  company: string;
  title: string;
  location: string;
  remoteType: string;
  jobType: string;
  salary: string;
  skills: string[];
  description: string;
  requirements: string[];
  postedAt: string;
  expiresAt: string;
  status: "open" | "closed";
};

export type Application = {
  id: string;
  jobId: string;
  recruiterId?: string;
  candidateId: string;
  candidateName: string;
  email: string;
  phone: string;
  location: string;
  resume: string;
  introVideo: string;
  coverNote: string;
  status: "new" | "reviewing" | "shortlisted" | "rejected";
  appliedAt: string;
};

export type Session = {
  userId: string;
};

export type ReminderTarget = "candidate" | "recruiter" | "owner";

export type Reminder = {
  id: string;
  recipientRole: ReminderTarget;
  recipientId: string;
  title: string;
  message: string;
  channel: "email" | "sms" | "in-app";
  source: "application" | "job" | "approval";
  createdAt: string;
  scheduledFor: string;
  status: "queued" | "sent" | "read";
};

export const OWNER_CONTACT = {
  email: "valibro9866@gmail.com",
  phoneNumbers: ["+919866094609", "+919900717717"],
};

const memory = {
  users: [] as User[],
  jobs: [] as Job[],
  applications: [] as Application[],
  reminders: [] as Reminder[],
  session: null as Session | null,
};

const dataSubscribers = new Set<() => void>();
let dataRevision = 0;
let realtimeStop: (() => void) | null = null;

function notifyDataSubscribers() {
  dataRevision += 1;
  dataSubscribers.forEach((subscriber) => subscriber());
}

export function subscribeToData(listener: () => void) {
  dataSubscribers.add(listener);
  return () => dataSubscribers.delete(listener);
}

export function getDataRevision() {
  return dataRevision;
}

export function useDataRevision() {
  return useSyncExternalStore(subscribeToData, getDataRevision, getDataRevision);
}

export async function hydrateFromFirestore() {
  if (typeof window === "undefined") return;
  try {
    const { getFirebaseAuth, isFirebaseConfigured, readFirestoreCollection } = await import("@/lib/firebase-client");
    if (!isFirebaseConfigured()) return;
    const authUser = getFirebaseAuth().currentUser;
    const uid = authUser?.uid;
    if (!authUser || !uid) return;
    const token = await authUser.getIdTokenResult();
    const isAdmin = token.claims.admin === true;
    // Realtime listeners hydrate jobs/applications/reminders immediately after
    // auth. Only the profile is needed synchronously to establish the session.
    const [users] = await Promise.all([
      isAdmin
        ? readFirestoreCollection<User>("users")
        : readFirestoreCollection<User>("users", { field: "id", value: uid }),
    ]);
    memory.users = users;
    notifyDataSubscribers();
  } catch (error) {
    console.error("Failed to load JobNest data from Firestore", error);
  }
}

export async function startRealtimeSync() {
  if (typeof window === "undefined" || realtimeStop) return;
  try {
    const { isFirebaseConfigured, subscribeToAuthorizedFirestore } = await import("@/lib/firebase-client");
    if (!isFirebaseConfigured()) return;
    realtimeStop = subscribeToAuthorizedFirestore((collectionName, records) => {
      if (collectionName === "users") {
        memory.users = records as User[];
      } else if (collectionName === "jobs") {
        memory.jobs = records as Job[];
      } else if (collectionName === "applications") {
        memory.applications = records as Application[];
      } else {
        memory.reminders = records as Reminder[];
      }
      notifyDataSubscribers();
    });
  } catch (error) {
    console.error("Failed to start JobNest realtime synchronization", error);
  }
}

export function stopRealtimeSync() {
  realtimeStop?.();
  realtimeStop = null;
}

export function ensureSeedData() {
  // Legacy localStorage/JSON seed data was intentionally removed. Production data
  // is loaded from Firestore by the authenticated client.
}

export function setSession(session: Session | null) {
  memory.session = session;
  notifyDataSubscribers();
}

export function getSession(): Session | null {
  return memory.session;
}

export function getUsers(): User[] {
  return memory.users;
}

export function getJobs(): Job[] {
  const jobs = memory.jobs;
  const now = Date.now();
  return jobs.filter((job) => {
    const expiresAt = new Date(job.expiresAt).getTime();
    return !Number.isNaN(expiresAt) && expiresAt > now && job.status === "open";
  });
}

export function getApplications(): Application[] {
  return memory.applications;
}

export function writeUsers(users: User[]) {
  const previous = memory.users;
  memory.users = users;
  notifyDataSubscribers();
  void persistCollection("users", users, previous);
}

export function writeJobs(jobs: Job[]) {
  const previous = memory.jobs;
  memory.jobs = jobs;
  notifyDataSubscribers();
  void persistCollection("jobs", jobs, previous);
}

export function writeApplications(applications: Application[]) {
  const previous = memory.applications;
  memory.applications = applications;
  notifyDataSubscribers();
  void persistCollection("applications", applications, previous);
}

export function getReminders(): Reminder[] {
  return memory.reminders;
}

export function writeReminders(reminders: Reminder[]) {
  const previous = memory.reminders;
  memory.reminders = reminders;
  notifyDataSubscribers();
  void persistCollection("reminders", reminders, previous);
}

async function persistCollection(
  collectionName: string,
  values: Array<{ id: string }>,
  previous: Array<{ id: string }> = [],
) {
  if (typeof window === "undefined") return;
  try {
    const { isFirebaseConfigured, saveFirestoreDocument } = await import("@/lib/firebase-client");
    if (!isFirebaseConfigured()) return;
    const previousById = new Map(previous.map((entry) => [entry.id, JSON.stringify(entry)]));
    const changed = values.filter((entry) => previousById.get(entry.id) !== JSON.stringify(entry));
    const results = await Promise.allSettled(changed.map((entry) => {
      const { id, ...value } = entry;
      return saveFirestoreDocument(
        collectionName,
        id,
        (collectionName === "users" ? { id, ...value } : value) as Record<string, unknown>,
      );
    }));
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures > 0) {
      console.warn(`Firestore saved ${changed.length - failures}/${changed.length} ${collectionName} change(s); retry after reconnect.`);
    }
  } catch (error) {
    console.error(`Failed to persist ${collectionName} in Firestore`, error);
  }
}

export function createReminder(reminder: Omit<Reminder, "id" | "createdAt" | "status">) {
  const reminders = getReminders();
  const duplicate = reminders.some((existing) => {
    const sameTarget = existing.recipientId === reminder.recipientId && existing.recipientRole === reminder.recipientRole;
    const sameMessage = existing.message === reminder.message;
    const sameSource = existing.source === reminder.source;
    const recent = new Date(existing.createdAt).getTime() > Date.now() - 1000 * 60 * 60 * 24;
    return sameTarget && sameMessage && sameSource && recent;
  });

  if (duplicate) {
    return false;
  }

  const newReminder: Reminder = {
    ...reminder,
    id: `reminder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "queued",
  };

  reminders.unshift(newReminder);
  writeReminders(reminders);
  return true;
}

export function markReminderRead(reminderId: string) {
  const reminders = getReminders().map((reminder) =>
    reminder.id === reminderId ? { ...reminder, status: "read" as const } : reminder,
  );
  writeReminders(reminders);
}

export function processReminderAutomation() {
  const users = getUsers();
  const allJobs = memory.jobs;
  const applications = getApplications();
  let generated = 0;
  const now = Date.now();

  allJobs.forEach((job) => {
    const expiresAt = new Date(job.expiresAt).getTime();
    if (job.status !== "open" || Number.isNaN(expiresAt) || expiresAt > now) {
      return;
    }

    writeJobs(memory.jobs.map((entry) =>
      entry.id === job.id ? { ...entry, status: "closed" as const } : entry,
    ));

    if (!getReminders().some(
      (reminder) =>
        reminder.recipientId === job.recruiterId &&
        reminder.recipientRole === "recruiter" &&
        reminder.source === "job" &&
        reminder.message.includes(`listing ${job.id} closed`),
    ) && createReminder({
      recipientRole: "recruiter",
      recipientId: job.recruiterId,
      title: "Job notice period ended",
      message: `Your listing ${job.id} closed because the notice period for ${job.title} ended. Review the applications retained in your dashboard.`,
      channel: "in-app",
      source: "job",
      scheduledFor: new Date().toISOString(),
    })) {
      generated += 1;
    }

    const candidateIds = new Set(
      applications
        .filter((application) => application.jobId === job.id)
        .map((application) => application.candidateId),
    );

    candidateIds.forEach((candidateId) => {
      if (!getReminders().some(
        (reminder) =>
          reminder.recipientId === candidateId &&
          reminder.recipientRole === "candidate" &&
          reminder.source === "job" &&
          reminder.message.includes(`listing ${job.id} closed`),
      ) && createReminder({
        recipientRole: "candidate",
        recipientId: candidateId,
        title: "Job notice period ended",
        message: `The listing ${job.id} for ${job.title} closed because its notice period ended. Your application history remains available in your dashboard.`,
        channel: "in-app",
        source: "job",
        scheduledFor: new Date().toISOString(),
      })) {
        generated += 1;
      }
    });
  });

  applications.forEach((application) => {
    const appliedAt = new Date(application.appliedAt).getTime();
    const ageHours = (Date.now() - appliedAt) / (1000 * 60 * 60);
    if (ageHours < 24 || ageHours > 48) {
      return;
    }

    if (!users.some((user) => user.id === application.candidateId)) {
      return;
    }

    const alreadyQueued = getReminders().some(
      (reminder) =>
        reminder.recipientId === application.candidateId &&
        reminder.recipientRole === "candidate" &&
        reminder.source === "application" &&
        reminder.message.includes(application.jobId),
    );

    if (!alreadyQueued) {
      const job = allJobs.find((entry) => entry.id === application.jobId);
      const triggered = createReminder({
        recipientRole: "candidate",
        recipientId: application.candidateId,
        title: "Application follow-up reminder",
        message: `You applied for ${job?.title ?? "a role"}. Please check your dashboard for the latest recruiter update and keep your profile current.`,
        channel: "email",
        source: "application",
        scheduledFor: new Date().toISOString(),
      });
      if (triggered) {
        generated += 1;
      }
    }
  });

  getJobs().forEach((job) => {
    const hoursUntilExpiry = (new Date(job.expiresAt).getTime() - now) / (1000 * 60 * 60);
    const newApplicants = applications.filter((application) => application.jobId === job.id).length;

    if (hoursUntilExpiry <= 72 && hoursUntilExpiry > 0 && newApplicants > 0) {
      const existing = getReminders().some(
        (reminder) =>
          reminder.recipientId === job.recruiterId &&
          reminder.recipientRole === "recruiter" &&
          reminder.source === "job" &&
          reminder.message.includes(job.id),
      );

      if (!existing) {
        const triggered = createReminder({
          recipientRole: "recruiter",
          recipientId: job.recruiterId,
          title: "Review deadline approaching",
          message: `Your listing, ${job.title}, is closing soon. Review the applicants for ${job.company} before the deadline expires.`,
          channel: "in-app",
          source: "job",
          scheduledFor: new Date().toISOString(),
        });
        if (triggered) {
          generated += 1;
        }
      }
    }
  });

  const pendingRecruiters = users.filter((user) => user.role === "recruiter" && user.approved === false);
  if (pendingRecruiters.length > 0) {
    const ownerReminder = getReminders().some(
      (reminder) => reminder.recipientRole === "owner" && reminder.source === "approval",
    );

    if (!ownerReminder) {
      const triggered = createReminder({
        recipientRole: "owner",
        recipientId: "site-owner",
        title: "Approval queue needs review",
        message: `${pendingRecruiters.length} recruiter account(s) are waiting for approval. Review and approve or reject them before they can publish jobs. Owner confirmation details: email ${OWNER_CONTACT.email} | phone ${OWNER_CONTACT.phoneNumbers.join(" / ")}.`,
        channel: "in-app",
        source: "approval",
        scheduledFor: new Date().toISOString(),
      });
      if (triggered) {
        generated += 1;
      }
    }
  }

  return generated;
}

export function startReminderAutomation() {
  if (typeof window === "undefined") {
    return;
  }

  const existingTimer = (window as typeof window & { __jobnestReminderAutomation?: number }).__jobnestReminderAutomation;
  if (existingTimer) {
    return;
  }

  const trigger = () => {
    processReminderAutomation();
  };

  trigger();
  const timerId = window.setInterval(trigger, 60_000);
  (window as typeof window & { __jobnestReminderAutomation?: number }).__jobnestReminderAutomation = timerId;
}

export function stopReminderAutomation() {
  if (typeof window === "undefined") {
    return;
  }

  const timerId = (window as typeof window & { __jobnestReminderAutomation?: number }).__jobnestReminderAutomation;
  if (timerId) {
    window.clearInterval(timerId);
    delete (window as typeof window & { __jobnestReminderAutomation?: number }).__jobnestReminderAutomation;
  }
}

export function getCurrentUser(): User | null {
  const session = getSession();
  if (!session) return null;

  return getUsers().find((user) => user.id === session.userId) ?? null;
}

export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function hasRole(role: UserRole) {
  const user = getCurrentUser();
  return user?.role === role;
}

export function isRecruiterApproved() {
  const user = getCurrentUser();
  return user?.role === "recruiter" ? user.approved !== false : true;
}

export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

export function validateRegistration(form: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
  linkedIn?: string;
  github?: string;
  location?: string;
  resume?: string;
  introVideo?: string;
}) {
  const trimmedName = form.name.trim();
  const trimmedEmail = form.email.trim();
  const trimmedPassword = form.password.trim();

  if (!trimmedName || trimmedName.length < 2) {
    return "Please use your real full name.";
  }

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return "Use a valid email address.";
  }

  if (trimmedPassword.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (form.role === "recruiter") {
    if (!form.companyName || form.companyName.trim().length < 2) {
      return "Please add the company or recruiting brand name.";
    }

    if (!form.phone || !/^\+?[0-9\s-]{8,}$/.test(form.phone.trim())) {
      return "Please add a valid contact number for the recruiter profile.";
    }
  }

  if (form.role === "candidate") {
    if (form.linkedIn && !/^https?:\/\/.+/.test(form.linkedIn.trim())) {
      return "LinkedIn profile must be a valid URL.";
    }

    if (form.github && !/^https?:\/\/.+/.test(form.github.trim())) {
      return "GitHub profile must be a valid URL.";
    }
  }

  if (form.location && form.location.trim().length < 2) {
    return "Location must be a real place name.";
  }

  if (form.resume && !isHttpUrl(form.resume)) {
    return "Resume link must start with http:// or https://.";
  }

  if (form.introVideo && !isHttpUrl(form.introVideo)) {
    return "Intro video link must start with http:// or https://.";
  }

  return "";
}

export function discardProfile(userId: string) {
  const users = getUsers().filter((user) => user.id !== userId);
  writeUsers(users);
}

export function validateApplicationSubmission(form: {
  name: string;
  email: string;
  phone: string;
  location: string;
  coverNote: string;
  resume?: string | null;
  introVideo?: string | null;
}) {
  if (!form.name || form.name.trim().length < 2) {
    return "Please use your real full name.";
  }

  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return "Please add a valid email address.";
  }

  if (!form.phone || !/^\+?[0-9\s-]{8,}$/.test(form.phone.trim())) {
    return "Please add a valid phone number.";
  }

  if (!form.location || form.location.trim().length < 2) {
    return "Please enter your current location.";
  }

  if (!form.resume) {
    return "Please add a shareable resume link before submitting.";
  }

  if (!isHttpUrl(form.resume)) {
    return "Resume link must start with http:// or https://.";
  }

  if (!form.coverNote || form.coverNote.trim().length < 25) {
    return "Your cover note should explain why you are a fit for this role.";
  }

  if (!form.introVideo) {
    return "Please add a shareable intro video link to complete your application.";
  }

  if (!isHttpUrl(form.introVideo)) {
    return "Intro video link must start with http:// or https://.";
  }

  return "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
import { useSyncExternalStore } from "react";
