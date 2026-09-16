import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type JobRecord = {
  recruiterId: string;
  title: string;
  company: string;
  expiresAt: string;
  status: "open" | "closed";
};

type ApplicationRecord = {
  jobId: string;
  candidateId: string;
  appliedAt: string;
};

function getAdminDb() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  }

  const app = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(serviceAccountJson)),
  });

  return getFirestore(app);
}

function assertCronSecret(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!configuredSecret || authorization !== "Bearer " + configuredSecret) {
    throw new Error("Unauthorized automation request.");
  }
}

export async function GET(request: NextRequest) {
  try {
    assertCronSecret(request);
    const db = getAdminDb();
    const now = Date.now();
    const jobsSnapshot = await db.collection("jobs").where("status", "==", "open").limit(500).get();
    const applicationsSnapshot = await db.collection("applications").limit(1000).get();
    const applications = applicationsSnapshot.docs.map((entry) => entry.data() as ApplicationRecord);
    const allJobsSnapshot = await db.collection("jobs").limit(500).get();
    const allJobs = new Map(allJobsSnapshot.docs.map((entry) => [entry.id, entry.data() as JobRecord]));
    const batch = db.batch();
    let closedJobs = 0;
    let createdReminders = 0;
    const reminderIds = new Set<string>();

    const enqueueReminder = async (
      reminderId: string,
      reminder: Record<string, string>,
    ) => {
      if (reminderIds.has(reminderId)) {
        return;
      }

      const reminderReference = db.collection("reminders").doc(reminderId);
      const existing = await reminderReference.get();
      if (existing.exists) {
        return;
      }

      batch.set(reminderReference, {
        id: reminderId,
        ...reminder,
        createdAt: new Date(now).toISOString(),
        scheduledFor: new Date(now).toISOString(),
        status: "queued",
      });
      reminderIds.add(reminderId);
      createdReminders += 1;
    };

    for (const jobDocument of jobsSnapshot.docs) {
      const job = jobDocument.data() as JobRecord;
      const expiresAt = new Date(job.expiresAt).getTime();
      if (Number.isNaN(expiresAt) || expiresAt > now) {
        continue;
      }

      batch.update(jobDocument.ref, {
        status: "closed",
        closedAt: new Date(now).toISOString(),
      });
      closedJobs += 1;

      const jobApplications = applications.filter((application) => application.jobId === jobDocument.id);
      const recipients = new Map<string, "candidate" | "recruiter">([
        [job.recruiterId, "recruiter"],
        ...jobApplications.map((application) => [application.candidateId, "candidate"] as const),
      ]);

      for (const [recipientId, recipientRole] of recipients) {
        const reminderId = `job-expired-${jobDocument.id}-${recipientRole}-${recipientId}`;
        const message = recipientRole === "recruiter"
          ? `Your listing ${jobDocument.id} closed because the notice period for ${job.title} ended. Review the applications retained in your dashboard.`
          : `The listing ${jobDocument.id} for ${job.title} closed because its notice period ended. Your application history remains available in your dashboard.`;

        await enqueueReminder(reminderId, {
          recipientRole,
          recipientId,
          title: "Job notice period ended",
          message,
          channel: "in-app",
          source: "job",
        });
      }
    }

    for (const applicationDocument of applicationsSnapshot.docs) {
      const application = applicationDocument.data() as ApplicationRecord;
      const appliedAt = new Date(application.appliedAt).getTime();
      const ageHours = (now - appliedAt) / (1000 * 60 * 60);
      if (ageHours < 24 || ageHours > 48) {
        continue;
      }

      const job = allJobs.get(application.jobId);
      await enqueueReminder(`application-follow-up-${applicationDocument.id}`, {
        recipientRole: "candidate",
        recipientId: application.candidateId,
        title: "Application follow-up reminder",
        message: `You applied for ${job?.title ?? "a role"}. Please check your dashboard for the latest recruiter update and keep your profile current.`,
        channel: "in-app",
        source: "application",
      });
    }

    for (const [jobId, job] of allJobs) {
      const hoursUntilExpiry = (new Date(job.expiresAt).getTime() - now) / (1000 * 60 * 60);
      const hasApplicants = applications.some((application) => application.jobId === jobId);
      if (job.status === "open" && hoursUntilExpiry > 0 && hoursUntilExpiry <= 72 && hasApplicants) {
        await enqueueReminder(`job-deadline-${jobId}-${job.recruiterId}`, {
          recipientRole: "recruiter",
          recipientId: job.recruiterId,
          title: "Review deadline approaching",
          message: `Your listing, ${job.title}, is closing soon. Review the applicants for ${job.company} before the deadline expires.`,
          channel: "in-app",
          source: "job",
        });
      }
    }

    await batch.commit();
    return NextResponse.json({ closedJobs, createdReminders, ranAt: new Date(now).toISOString() });
  } catch (error) {
    console.error("JobNest automation failed", error);
    const message = error instanceof Error ? error.message : "Automation failed.";
    const status = message === "Unauthorized automation request." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
