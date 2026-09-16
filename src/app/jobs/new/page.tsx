"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentUser, getJobs, Job, setSession, writeJobs } from "@/lib/jobnest-data";
import { SiteBrand } from "@/components/site-brand";
import { signOutFirebase } from "@/lib/firebase-client";

const defaultValues = {
  company: "",
  title: "",
  location: "",
  remoteType: "Remote",
  jobType: "Full-time",
  salary: "",
  skills: "",
  description: "",
  requirements: "",
  expiresAt: "",
};

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultValues);
  const [error, setError] = useState("");
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      router.replace("/?auth=signin");
      return;
    }

    if (currentUser.role !== "recruiter") {
      router.replace("/dashboard");
      return;
    }

    if (currentUser.approved === false) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  const handleChange = (field: keyof typeof defaultValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const user = getCurrentUser();

    if (!user || user.role !== "recruiter") {
      setError("Only approved recruiters can post jobs. Please log in with a recruiter account.");
      return;
    }

    if (user.approved === false) {
      setError("Recruiter access is pending approval from the site owner.");
      return;
    }

    if (!form.title || !form.company || !form.description) {
      setError("Please complete the title, company name, and description.");
      return;
    }

    if (!form.expiresAt) {
      setError("Please choose a job notice closing date.");
      return;
    }

    const jobs = getJobs();
    const nextDeadline = new Date(form.expiresAt).getTime();
    if (Number.isNaN(nextDeadline) || nextDeadline <= Date.now()) {
      setError("Notice expiry date must be in the future.");
      return;
    }

    const newJob: Job = {
      id: `job-${Date.now()}`,
      recruiterId: user.id,
      recruiterName: user.name,
      company: form.company,
      title: form.title,
      location: form.location || "Remote",
      remoteType: form.remoteType,
      jobType: form.jobType,
      salary: form.salary || "Negotiable",
      skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean),
      description: form.description,
      requirements: form.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      postedAt: new Date().toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      status: "open",
    };

    jobs.unshift(newJob);
    writeJobs(jobs);
    router.push(`/jobs/${newJob.id}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex">
              <SiteBrand compact />
            </Link>
            <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition">
              <span>🏠</span> Home
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">View jobs</Link>
            <button type="button" onClick={() => { void signOutFirebase(); setSession(null); router.push("/"); }} className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Logout</button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/20">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Post a job</p>
          <h1 className="mt-3 text-3xl font-bold">Create a live job notice</h1>
          <p className="mt-2 text-slate-300">The notice stays visible until the closing date you set.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Job title</label>
                <input value={form.title} onChange={(event) => handleChange("title", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Frontend Engineer" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Company name</label>
                <input value={form.company} onChange={(event) => handleChange("company", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Northstar Labs" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Location</label>
                <input value={form.location} onChange={(event) => handleChange("location", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Remote" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Work mode</label>
                <select value={form.remoteType} onChange={(event) => handleChange("remoteType", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400">
                  <option>Remote</option>
                  <option>Hybrid</option>
                  <option>Onsite</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Job type</label>
                <select value={form.jobType} onChange={(event) => handleChange("jobType", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400">
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Salary</label>
                <input value={form.salary} onChange={(event) => handleChange("salary", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="$80k - $120k" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Closing date</label>
                <input type="date" value={form.expiresAt} onChange={(event) => handleChange("expiresAt", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Skills</label>
              <input value={form.skills} onChange={(event) => handleChange("skills", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Next.js, TypeScript, product design" />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Job description</label>
              <textarea value={form.description} onChange={(event) => handleChange("description", event.target.value)} className="min-h-36 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Describe the role, impact, and responsibilities." />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Requirements (one per line)</label>
              <textarea value={form.requirements} onChange={(event) => handleChange("requirements", event.target.value)} className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Strong communication skills
Knowledge of SaaS workflows
3+ years of experience" />
            </div>

            {error ? <p className="text-sm text-rose-400">{error}</p> : null}

            <button type="submit" className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400">
              Publish job
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
