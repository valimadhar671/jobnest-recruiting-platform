"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  OWNER_CONTACT,
  getApplications,
  getCurrentUser,
  getJobs,
  getUsers,
  setSession,
  writeApplications,
  writeUsers,
  useDataRevision,
  Application,
  User
} from "@/lib/jobnest-data";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";

export default function DashboardPage() {
  const router = useRouter();
  const dataRevision = useDataRevision();
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [applications, setApps] = useState<Application[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [actionMessage, setActionMessage] = useState<string>("");

  useEffect(() => {
    const current = getCurrentUser();
    if (!current) {
      router.replace("/?auth=signin");
      return;
    }
    window.setTimeout(() => {
      setUser(current);
      setApps(getApplications());
      setUsersList(getUsers());
    }, 0);
  }, [router, dataRevision]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          <p className="text-lg font-semibold">Please sign in to access your dashboard.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/?auth=signin" className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950">
              Login
            </Link>
            <Link href="/signup" className="rounded-xl border border-white/10 px-4 py-2 font-medium text-white">
              Sign up
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const jobs = getJobs();
  const isOwner = user.email === OWNER_CONTACT.email || user.id === "site-owner";
  const isRecruiterApproved = user.role === "recruiter" ? user.approved !== false : true;

  const myJobs = user.role === "recruiter" ? jobs.filter((job) => job.recruiterId === user.id) : [];

  const candidateApplications = user.role === "candidate"
    ? applications.filter((app) => app.candidateId === user.id)
    : [];
  const candidateInProgress = candidateApplications.filter((app) => app.status === "new" || app.status === "reviewing").length;
  const candidateReplied = candidateApplications.filter((app) => app.status === "shortlisted" || app.status === "rejected").length;
  const candidateSelected = candidateApplications.filter((app) => app.status === "shortlisted").length;

  const recruiterReceivedApps = user.role === "recruiter"
    ? applications.filter((app) => myJobs.some((j) => j.id === app.jobId))
    : [];

  const pendingRecruiters = usersList.filter((u) => u.role === "recruiter" && u.approved === false);

  const handleLogout = () => {
    setSession(null);
    if (isFirebaseConfigured()) {
      void signOut(getFirebaseAuth());
    }
    router.push("/");
  };

  const handleApproveRecruiter = (recruiterId: string) => {
    const updatedUsers = usersList.map((u) => u.id === recruiterId ? { ...u, approved: true, status: "active" as const } : u);
    writeUsers(updatedUsers);
    setUsersList(updatedUsers);
    setActionMessage("Recruiter account approved successfully!");
  };

  const handleRejectRecruiter = (recruiterId: string) => {
    const updatedUsers = usersList.map((u) => u.id === recruiterId ? { ...u, approved: false, status: "rejected" as const } : u);
    writeUsers(updatedUsers);
    setUsersList(updatedUsers);
    setActionMessage("Recruiter account application rejected.");
  };

  const handleUpdateApplicationStatus = (appId: string, status: "new" | "reviewing" | "shortlisted" | "rejected") => {
    const updatedApps = applications.map((app) => app.id === appId ? { ...app, status } : app);
    writeApplications(updatedApps);
    setApps(updatedApps);
    setActionMessage(`Application status updated to "${status.toUpperCase()}".`);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        
        {/* Dashboard Top Header */}
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-cyan-400">
                JobNest Workspace
              </span>
              {isOwner && (
                <span className="rounded-full bg-purple-500/20 border border-purple-400/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                  Platform Admin / Owner
                </span>
              )}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white">Welcome back, {user.name}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {user.role === "recruiter" ? `Company: ${user.companyName || "Independent recruiter"}` : `Role: Candidate Developer`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition">
              <span>🏠</span> Home
            </Link>
            <Link href="/jobs" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">
              Browse Jobs ({jobs.length})
            </Link>
            {user.role === "recruiter" && isRecruiterApproved && (
              <Link href="/jobs/new" className="rounded-full bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
                + Post Job Notice
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-300 flex items-center justify-between">
            <span>✓ {actionMessage}</span>
            <button onClick={() => setActionMessage("")} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {user.role === "candidate" && (
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 to-slate-900 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-2xl font-black text-slate-950">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-cyan-300">Candidate profile</p>
                  <h2 className="mt-1 truncate text-2xl font-extrabold text-white">{user.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-300">{user.email}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {[user.location, user.phone].filter(Boolean).join(" • ") || "Add your location and phone in your profile"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">Application activity</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <p className="text-3xl font-black text-white">{candidateApplications.length}</p>
                  <p className="mt-1 text-xs text-slate-400">Jobs applied</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <p className="text-3xl font-black text-cyan-300">{candidateReplied}</p>
                  <p className="mt-1 text-xs text-slate-400">Replied</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-200">{candidateInProgress} in progress</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">{candidateSelected} selected</span>
              </div>
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Account Role</p>
            <p className="mt-2 text-2xl font-extrabold text-cyan-300 capitalize">{user.role}</p>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {user.role === "recruiter" ? "My Active Postings" : "My Submitted Applications"}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {user.role === "recruiter" ? myJobs.length : candidateApplications.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {user.role === "recruiter" ? "Pending Approvals" : "Active Profile Status"}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {user.role === "recruiter" ? pendingRecruiters.length : "Verified"}
            </p>
          </div>
        </section>

        {/* Owner Approval Panel */}
        {isOwner && (
          <section className="mt-8 rounded-3xl border border-purple-500/30 bg-purple-500/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">Platform Administration</span>
                <h2 className="text-xl font-bold text-white mt-0.5">Recruiter Access Approval Queue</h2>
              </div>
              <span className="rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1 border border-purple-500/40">
                {pendingRecruiters.length} Pending
              </span>
            </div>

            {pendingRecruiters.length > 0 ? (
              <div className="space-y-3">
                {pendingRecruiters.map((rec) => (
                  <div key={rec.id} className="rounded-2xl border border-white/10 bg-slate-950 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{rec.name}</span>
                        <span className="text-xs font-mono text-cyan-400">({rec.companyName})</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Email: {rec.email} | Phone: {rec.phone}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveRecruiter(rec.id)}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
                      >
                        Approve Account
                      </button>
                      <button
                        onClick={() => handleRejectRecruiter(rec.id)}
                        className="rounded-xl border border-red-500/40 text-red-400 px-4 py-2 text-xs font-bold hover:bg-red-500/10 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-950/60 p-4 rounded-xl border border-dashed border-white/10">
                All recruiter accounts are currently reviewed and approved.
              </p>
            )}
          </section>
        )}

        {/* Recruiter Pending Warning */}
        {user.role === "recruiter" && !isRecruiterApproved && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-xs text-amber-200">
            <strong>Recruiter Account Approval Required:</strong> Your recruiting profile is currently in the approval queue. Job publishing will unlock once approved by Platform Admin. Owner contact: <strong>{OWNER_CONTACT.email}</strong> ({OWNER_CONTACT.phoneNumbers.join(" / ")}).
          </div>
        )}

        {/* Main Content Grid */}
        <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          
          {/* Main Workspace Column */}
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {user.role === "recruiter" ? "Received Applications Pipeline" : "My Applications Status"}
            </h2>

            {/* Recruiter Application Review View */}
            {user.role === "recruiter" ? (
              recruiterReceivedApps.length > 0 ? (
                <div className="space-y-4">
                  {recruiterReceivedApps.map((app) => {
                    const job = jobs.find((j) => j.id === app.jobId);
                    return (
                      <div key={app.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">For Role: {job?.title}</span>
                            <h3 className="text-base font-bold text-white mt-0.5">{app.candidateName}</h3>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${
                            app.status === "shortlisted" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                            app.status === "rejected" ? "bg-red-500/20 text-red-300 border-red-500/40" :
                            app.status === "reviewing" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                            "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          }`}>
                            {app.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed mb-3">{app.coverNote}</p>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                          <div className="flex items-center gap-3 text-xs">
                            <a href={app.resume} target="_blank" rel="noreferrer" className="text-cyan-400 font-bold hover:underline">
                              📄 View Resume
                            </a>
                            <a href={app.introVideo} target="_blank" rel="noreferrer" className="text-purple-400 font-bold hover:underline">
                              🎥 Watch Video Intro
                            </a>
                          </div>

                          {/* Status Actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateApplicationStatus(app.id, "reviewing")}
                              className="text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-amber-500/20 hover:text-amber-300 px-2 py-1 rounded text-slate-300"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleUpdateApplicationStatus(app.id, "shortlisted")}
                              className="text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-emerald-500/20 hover:text-emerald-300 px-2 py-1 rounded text-slate-300"
                            >
                              Shortlist
                            </button>
                            <button
                              onClick={() => handleUpdateApplicationStatus(app.id, "rejected")}
                              className="text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-300 px-2 py-1 rounded text-slate-300"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-center text-xs text-slate-400">
                  No candidate applications received yet. As candidates submit applications to your listings, they will appear here for review.
                </div>
              )
            ) : (
              /* Candidate Applications List */
              candidateApplications.length > 0 ? (
                <div className="space-y-4">
                  {candidateApplications.map((app) => {
                    const job = jobs.find((j) => j.id === app.jobId);
                    return (
                      <div key={app.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">{job?.company ?? "Company"}</span>
                            <h3 className="text-base font-bold text-white">{job?.title ?? "Job Title"}</h3>
                            <p className="text-xs text-slate-400 mt-1">Applied on: {new Date(app.appliedAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${
                            app.status === "shortlisted" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                            app.status === "rejected" ? "bg-red-500/20 text-red-300 border-red-500/40" :
                            app.status === "reviewing" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                            "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          }`}>
                            {app.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-center text-xs text-slate-400">
                  You haven&apos;t submitted any job applications yet. Browse active openings to apply.
                </div>
              )
            )}
          </div>

          {/* Profile Sidebar */}
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Profile & Links</h2>
            <div className="space-y-3.5">
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Full Name</p>
                <p className="text-sm font-bold text-white mt-1">{user.name}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Email Address</p>
                <p className="text-sm font-bold text-white mt-1">{user.email}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Online Portfolios</p>
                <div className="mt-2 space-y-1 text-xs">
                  {user.linkedIn ? (
                    <a href={user.linkedIn} target="_blank" rel="noreferrer" className="block text-cyan-400 font-bold hover:underline">
                      🔗 LinkedIn Profile
                    </a>
                  ) : (
                    <span className="text-slate-500 block">LinkedIn: Not linked</span>
                  )}
                  {user.github ? (
                    <a href={user.github} target="_blank" rel="noreferrer" className="block text-cyan-400 font-bold hover:underline">
                      💻 GitHub Profile (@valimadhar671)
                    </a>
                  ) : (
                    <span className="text-slate-500 block">GitHub: Not linked</span>
                  )}
                </div>
              </div>

              {/* Registered Candidate Attachments */}
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Registered Candidate Attachments</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  {user.resume ? (
                    <a href={user.resume} target="_blank" rel="noreferrer" className="block font-bold text-cyan-400 hover:underline">
                      📄 View Registered Resume (PDF)
                    </a>
                  ) : (
                    <span className="text-slate-500 block">Resume: Not attached at signup</span>
                  )}
                  {user.introVideo ? (
                    <a href={user.introVideo} target="_blank" rel="noreferrer" className="block font-bold text-purple-400 hover:underline">
                      🎥 Play Short Intro Video (MP4)
                    </a>
                  ) : (
                    <span className="text-slate-500 block">Intro Video: Not attached at signup</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Site Support & Owner</p>
                <p className="text-xs text-slate-300 mt-1">Email: {OWNER_CONTACT.email}</p>
                <p className="text-xs text-slate-300">Phone: {OWNER_CONTACT.phoneNumbers[0]}</p>
              </div>
            </div>
          </div>

        </section>

      </div>
    </main>
  );
}
