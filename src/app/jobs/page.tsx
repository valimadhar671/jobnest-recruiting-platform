"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, getJobs, getSession, setSession, useDataRevision } from "@/lib/jobnest-data";
import { signOutFirebase } from "@/lib/firebase-client";
import { SiteBrand } from "@/components/site-brand";

const quickFilters = ["All roles", "Remote", "Hybrid", "Full-time", "Contract"];

export default function JobsPage() {
  useDataRevision();
  const jobs = getJobs();
  const isLoggedIn = Boolean(getSession());
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("All roles");
  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.description} ${job.skills.join(" ")}`.toLowerCase();
    const matchesSearch = !search.trim() || text.includes(search.trim().toLowerCase());
    const matchesLocation = !location || job.location === location;
    const matchesFilter = filter === "All roles"
      || (filter === "Remote" && job.remoteType === "Remote")
      || (filter === "Hybrid" && job.remoteType === "Hybrid")
      || (filter === "Full-time" && job.jobType === "Full-time")
      || (filter === "Contract" && job.jobType === "Contract");
    return matchesSearch && matchesLocation && matchesFilter;
  }), [filter, jobs, location, search]);
  const locations = Array.from(new Set(jobs.map((job) => job.location))).sort();

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-full border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex">
                <SiteBrand compact />
              </Link>
              <Link href="/" className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                <span>🏠</span> Home
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-500">Dashboard</Link>
                  <button type="button" onClick={() => { setSession(null); void signOutFirebase(); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Logout</button>
                </>
              ) : (
                <>
                  <Link href="/?auth=signin" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Login</Link>
                  <Link href="/signup" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-500">Join now</Link>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Job board</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">Find active openings</h1>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
              Real notices only
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <input aria-label="Search jobs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job title or keyword" className="w-full bg-transparent outline-none" />
              </div>
              <select aria-label="Filter by location" value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                <option value="">Any location</option>
                {locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button type="button" onClick={() => { setSearch(""); setLocation(""); setFilter("All roles"); }} className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">
                Clear search
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {quickFilters.map((item) => (
              <button type="button" key={item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${filter === item ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          {filteredJobs.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
              {jobs.length === 0 ? "No live jobs are published yet. Once a recruiter is approved and a notice is posted, it will appear here until its closing date." : "No jobs match your search."}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              {filteredJobs.map((job) => (
                <article key={job.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sky-700">{job.company}</p>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">{job.title}</h2>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      {job.remoteType}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>{job.location}</p>
                    <p>{job.jobType}</p>
                    <p className="font-semibold text-slate-900">{job.salary}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                    <span>Posted {formatDate(job.postedAt)}</span>
                    <Link href={`/jobs/${job.id}`} className="font-semibold text-sky-700 transition hover:text-sky-600">
                      View details →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
