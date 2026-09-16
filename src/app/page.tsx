"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, FormEvent, useRef } from "react";
import { setSession, getJobs, getUsers, getApplications, ensureSeedData, Job, User, getCurrentUser, writeUsers } from "@/lib/jobnest-data";
import { SiteBrand } from "@/components/site-brand";
import { ContactSupportButton } from "@/components/contact-modal";
import { signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseAuth, getGithubProvider, getGoogleProvider, isFirebaseConfigured } from "@/lib/firebase-client";

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [recruiterCount, setRecruiterCount] = useState<number>(0);
  const [verifiedCompaniesCount, setVerifiedCompaniesCount] = useState<number>(0);
  const [applicationsCount, setApplicationsCount] = useState<number>(0);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth") === "signin") {
      window.setTimeout(() => setIsAuthModalOpen(true), 0);
    }

    ensureSeedData();
    const user = getCurrentUser();
    window.setTimeout(() => setCurrentUser(user), 0);

    const jobs = getJobs();
    const users = getUsers();
    const apps = getApplications();

    const recruiters = users.filter((u) => u.role === "recruiter");
    const uniqueCompanies = new Set(
      recruiters
        .map((r) => r.companyName || r.name)
        .concat(jobs.map((j) => j.company))
        .filter(Boolean)
    );
    window.setTimeout(() => {
      setActiveJobs(jobs);
      setRecruiterCount(recruiters.length);
      setVerifiedCompaniesCount(uniqueCompanies.size);
      setApplicationsCount(apps.length);
    }, 0);

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setSession(null);
    setCurrentUser(null);
    setIsMenuOpen(false);
    if (isFirebaseConfigured()) {
      void signOut(getFirebaseAuth());
    }
    router.refresh();
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setError("");
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local.");
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const result = await signInWithPopup(
        getFirebaseAuth(),
        provider === "google" ? getGoogleProvider() : getGithubProvider(),
      );
      const users = getUsers();
      if (!users.some((user) => user.id === result.user.uid)) {
        users.push({
          id: result.user.uid,
          name: result.user.displayName || result.user.email?.split("@")[0] || "JobNest user",
          email: result.user.email || "",
          role: "candidate",
          approved: true,
          status: "active",
          createdAt: new Date().toISOString(),
        });
        writeUsers(users);
      }
      setSession({ userId: result.user.uid });
      setCurrentUser(getUsers().find((user) => user.id === result.user.uid) || null);
      setIsAuthModalOpen(false);
      router.push("/dashboard");
    } catch {
      setError("Firebase provider sign-in failed. Please try again.");
    }
  };

  const getDomainAuthHint = (emailStr: string) => {
    const trimmed = emailStr.trim().toLowerCase();
    if (!trimmed.includes("@")) return null;
    if (trimmed === "valibro9866@gmail.com") {
      return { type: "admin", label: "👑 Platform Owner Authorization" };
    }
    const domain = trimmed.split("@")[1];
    if (domain === "gmail.com" || domain === "yahoo.com" || domain === "outlook.com" || domain.endsWith(".edu") || domain.endsWith(".ac.in")) {
      return { type: "candidate", label: "👤 Candidate Authorization" };
    }
    return { type: "recruiter", label: `🏢 Corporate Recruiter (${domain.split(".")[0].toUpperCase()})` };
  };

  const domainHint = getDomainAuthHint(email);

  const handleDirectSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isFirebaseConfigured()) {
        setError("Firebase is not configured. Configure the NEXT_PUBLIC_FIREBASE_* values before signing in.");
        setLoading(false);
        return;
      }

      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const users = getUsers();
      if (!users.some((u) => u.id === credential.user.uid)) {
        users.push({
          id: credential.user.uid,
          name: credential.user.displayName || credential.user.email?.split("@")[0] || "JobNest user",
          email: credential.user.email || email.trim(),
          role: "candidate",
          approved: true,
          status: "active",
          createdAt: new Date().toISOString(),
        });
        writeUsers(users);
      }

      setSession({ userId: credential.user.uid });
      setCurrentUser(getUsers().find((u) => u.id === credential.user.uid) || null);
      setLoading(false);
      setIsAuthModalOpen(false);
      router.push("/dashboard");
    } catch {
      setError("Firebase sign-in failed. Please check your email and password.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-900 flex flex-col justify-between">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 w-full">
        
        {/* Header Navigation with 3-Lines Dropdown Menu */}
        <header className="sticky top-4 z-20 mb-8 rounded-full border border-slate-200/80 bg-white/95 px-5 py-2.5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center">
              <SiteBrand compact />
            </Link>

            <div className="relative flex items-center gap-2.5 text-xs font-bold" ref={menuRef}>
              <Link href="/jobs" className="rounded-full bg-slate-100 px-3.5 py-2 text-slate-700 transition hover:bg-slate-200 hover:text-slate-950">
                Jobs ({activeJobs.length})
              </Link>

              {currentUser ? (
                /* Logged In Navigation */
                <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 p-1 pl-3.5">
                  <span className="text-sky-900 font-extrabold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    {currentUser.name}
                  </span>
                  <Link href="/dashboard" className="rounded-full bg-sky-600 px-3.5 py-1.5 text-white transition hover:bg-sky-500 shadow-sm">
                    Dashboard
                  </Link>
                </div>
              ) : (
                /* Guest Navigation Buttons */
                <>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-800 transition hover:border-sky-300 hover:bg-slate-50"
                  >
                    Sign In
                  </button>
                  <Link
                    href="/signup"
                    className="rounded-full bg-sky-600 px-4 py-2 text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-500"
                  >
                    Register Account
                  </Link>
                </>
              )}

              {/* 3-Lines Hamburger Menu Button beside Register */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  isMenuOpen ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                }`}
                title="Navigation Menu"
                aria-label="Toggle Menu"
              >
                <div className="flex flex-col gap-1 items-center justify-center">
                  <span className="h-0.5 w-4 rounded-full bg-current"></span>
                  <span className="h-0.5 w-4 rounded-full bg-current"></span>
                  <span className="h-0.5 w-4 rounded-full bg-current"></span>
                </div>
              </button>

              {/* 3-Lines Floating Dropdown Overlay */}
              {isMenuOpen && (
                <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 z-30">
                  {currentUser ? (
                    <div className="space-y-1">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Signed in as</p>
                        <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                      </div>

                      <Link
                        href="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>📊</span> Personal Dashboard
                      </Link>

                      <Link
                        href="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>👤</span> Account Profile
                      </Link>

                      <Link
                        href="/jobs"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>📄</span> Jobs Applied Shortcut ({activeJobs.length})
                      </Link>

                      <div className="pt-1 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                        >
                          <span>🚪</span> Logout
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Navigation Menu</p>
                        <p className="text-xs font-bold text-slate-900">JobNest Recruitment</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setIsMenuOpen(false); setIsAuthModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>🔑</span> Sign In
                      </button>

                      <Link
                        href="/signup"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>✍️</span> Register Account
                      </Link>

                      <button
                        type="button"
                        onClick={() => { setIsMenuOpen(false); setIsAuthModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>📊</span> My Dashboard
                      </button>

                      <Link
                        href="/jobs"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span>💼</span> Browse Available Jobs ({activeJobs.length})
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="rounded-[2.25rem] border border-slate-200 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10 mb-12">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            
            {/* Left Hero Banner */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Recruiter-First Hiring Platform
              </div>

              <h1 className="max-w-xl text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl leading-[1.1]">
                Find the right people for your next hire.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                JobNest helps approved recruiters post verified openings, collect quality candidate applications, and evaluate submissions with resumes, portfolio links, and video intros.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {currentUser ? (
                  <Link href="/dashboard" className="rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-500">
                    Open Workspace Dashboard →
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-500"
                    >
                      Sign In Now
                    </button>
                    <Link href="/jobs" className="rounded-full border border-slate-200 bg-white px-6 py-3 font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50">
                      Browse {activeJobs.length} Jobs
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right Featured Openings Card */}
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600">Featured Openings</span>
                  <h2 className="text-lg font-extrabold text-slate-900">Active Job Notices</h2>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {activeJobs.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 border-dashed bg-white p-6 text-center">
                    <p className="text-sm font-bold text-slate-800">No active job notices posted yet.</p>
                    <p className="mt-1 text-xs text-slate-500">Verified recruiters can sign in to post real open positions.</p>
                  </div>
                ) : (
                  activeJobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-sky-300">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">{job.company}</span>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">{job.title}</h3>
                        </div>
                        <span className="rounded bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5">
                          {job.remoteType}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{job.salary}</span>
                        <Link href={`/jobs/${job.id}`} className="font-bold text-sky-600 hover:underline">
                          Apply →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 text-center">
                <Link href="/jobs" className="text-xs font-bold text-sky-700 hover:text-sky-900">
                  View All {activeJobs.length} Available Jobs →
                </Link>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Modern Footer Section with Live Stat Metric Slots */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-950 text-white pt-12 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Live Real-Data Metric Slots Grid */}
          <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            
            {/* Slot 1: Jobs Posted */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-sky-500/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">Slot 01</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="mt-3 text-3xl sm:text-4xl font-black text-white">{activeJobs.length}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">Live Jobs Posted</p>
              <p className="mt-1 text-[10px] text-slate-400">Verified openings currently open</p>
            </div>

            {/* Slot 2: Recruiters Logged In */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-emerald-500/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">Slot 02</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="mt-3 text-3xl sm:text-4xl font-black text-white">{recruiterCount}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">Recruiters Logged In</p>
              <p className="mt-1 text-[10px] text-slate-400">Registered hiring managers</p>
            </div>

            {/* Slot 3: Verified Companies */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-purple-500/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">Slot 03</span>
                <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              </div>
              <p className="mt-3 text-3xl sm:text-4xl font-black text-white">{verifiedCompaniesCount}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">Verified Companies</p>
              <p className="mt-1 text-[10px] text-slate-400">Corporate domain organizations</p>
            </div>

            {/* Slot 4: Applications Submitted */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">Slot 04</span>
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              </div>
              <p className="mt-3 text-3xl sm:text-4xl font-black text-white">{applicationsCount}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">Candidate Submissions</p>
              <p className="mt-1 text-[10px] text-slate-400">Live resume & video applications</p>
            </div>

          </div>

          {/* Footer Bottom Info */}
          <div className="flex flex-col gap-6 pt-6 border-t border-white/10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white font-black text-slate-950 text-xs">
                JN
              </div>
              <span className="text-sm font-bold text-white">JobNest Platform</span>
              <span className="text-xs text-slate-500">© 2026 JobNest Network</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <Link href="/jobs" className="hover:text-cyan-300">Jobs Board</Link>
              <Link href="/dashboard" className="hover:text-cyan-300">Dashboard</Link>
              <ContactSupportButton variant="compact" />
            </div>
          </div>

        </div>
      </footer>

      {/* Standard Website Auth Modal Overlay */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 text-white shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-cyan-400">
                  Account Sign In
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">Welcome to JobNest</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Direct OAuth Provider Buttons */}
            <div className="space-y-2.5 mb-5">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10"
              >
                <span>🌐</span> Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuthSignIn("github")}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10"
              >
                <span>💻</span> Continue with GitHub
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              or sign in with email
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Direct Email / Password Authorization Form */}
            <form onSubmit={handleDirectSignIn} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  {domainHint && (
                    <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      {domainHint.label}
                    </span>
                  )}
                </div>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com or name@gmail.com"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              {error && (
                <p className="text-xs font-bold text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-400 shadow-lg shadow-cyan-500/20"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 pt-3 border-t border-white/10 text-center">
              <p className="text-xs text-slate-400">
                Don&apos;t have an account yet?{" "}
                <Link href="/signup" onClick={() => setIsAuthModalOpen(false)} className="font-bold text-cyan-300 hover:underline">
                  Create Account →
                </Link>
              </p>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
