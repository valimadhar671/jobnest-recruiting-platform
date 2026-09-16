"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Application, getApplications, getCurrentUser, getJobs, setSession, validateApplicationSubmission, writeApplications } from "@/lib/jobnest-data";
import { SiteBrand } from "@/components/site-brand";
import { signOutFirebase } from "@/lib/firebase-client";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const targetId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const currentUser = getCurrentUser();
  const job = getJobs().find((listing) => listing.id === targetId) ?? null;

  useEffect(() => {
    if (!currentUser) {
      router.replace("/?auth=signin");
    }
  }, [currentUser, router]);

  const [form, setForm] = useState({
    name: currentUser?.name ?? "",
    email: currentUser?.email ?? "",
    phone: currentUser?.phone ?? "",
    location: currentUser?.location ?? "",
    coverNote: "",
    resume: currentUser?.resume ?? "",
    introVideo: currentUser?.introVideo ?? "",
  });

  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!job) return;

    const validationError = validateApplicationSubmission({
      name: form.name,
      email: form.email,
      phone: form.phone,
      location: form.location,
      coverNote: form.coverNote,
      resume: form.resume,
      introVideo: form.introVideo,
    });

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const newApplication: Application = {
      id: createId("app"),
      jobId: job.id,
      recruiterId: job.recruiterId,
      candidateId: currentUser?.id ?? createId("guest"),
      candidateName: form.name,
      email: form.email,
      phone: form.phone,
      location: form.location,
      resume: form.resume.trim(),
      introVideo: form.introVideo.trim(),
      coverNote: form.coverNote,
      status: "new",
      appliedAt: new Date().toISOString(),
    };

    const applications = getApplications();
    applications.unshift(newApplication);
    writeApplications(applications);

    setMessage("Application submitted with resume & video! Redirecting to Dashboard...");

    setTimeout(() => {
      router.push("/dashboard");
    }, 1200);
  };

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-semibold">Job Listing Not Found</h1>
          <Link href="/jobs" className="mt-5 inline-block rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
            Browse All Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        
        {/* Navigation Header */}
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <SiteBrand compact />
            </Link>
            <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition">
              <span>🏠</span> Home
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link href="/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => { void signOutFirebase(); setSession(null); router.push("/"); }}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/?auth=signin" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
                Login
              </Link>
            )}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          
          {/* Job Info Panel */}
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-8">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-cyan-400">
              {job.company}
            </span>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold">{job.title}</h1>
            
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
              <span className="rounded bg-white/5 px-2.5 py-1">{job.location}</span>
              <span className="rounded bg-white/5 px-2.5 py-1">{job.jobType}</span>
              <span className="rounded bg-white/5 px-2.5 py-1">{job.remoteType}</span>
            </div>

            <p className="mt-4 text-xl font-bold text-cyan-300">{job.salary}</p>
            
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">
              Notice closing date: <strong>{new Date(job.expiresAt).toLocaleDateString()}</strong>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-bold text-white">Job Overview</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{job.description}</p>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-bold text-white">Key Requirements</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {job.requirements.map((req) => (
                  <li key={req} className="flex gap-2">
                    <span className="text-cyan-400 font-bold">•</span> {req}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Application Form */}
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Apply for Role</h2>
                <p className="text-xs text-slate-400">Submit your application directly to {job.recruiterName}.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Full Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Email Address</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Resume link
                </label>
                <input
                  type="url"
                  value={form.resume}
                  onChange={(e) => setForm({ ...form, resume: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Intro video link
                </label>
                <input
                  type="url"
                  value={form.introVideo}
                  onChange={(e) => setForm({ ...form, introVideo: e.target.value })}
                  placeholder="https://youtube.com/..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Cover Note</label>
                <textarea
                  rows={3}
                  value={form.coverNote}
                  onChange={(e) => setForm({ ...form, coverNote: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="Explain why you are a great fit for this role..."
                />
              </div>

              {message && (
                <div className={`p-3 rounded-xl text-xs font-bold ${message.includes("submitted") ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
              >
                Submit Application
              </button>
            </form>
          </div>

        </div>
      </div>
    </main>
  );
}
