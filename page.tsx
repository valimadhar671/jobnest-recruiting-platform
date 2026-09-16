"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getUsers, setSession, validateRegistration, writeUsers } from "@/lib/jobnest-data";
import { SiteBrand } from "@/components/site-brand";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "candidate" as "candidate" | "recruiter",
  companyName: "",
  phone: "",
  location: "",
};

function getFirebaseErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (code.includes("auth/email-already-in-use")) return "An account already exists for this email.";
    if (code.includes("auth/weak-password")) return "Password must be at least 6 characters.";
  }
  return "Firebase authentication failed. Please try again.";
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [candidateLinks, setCandidateLinks] = useState({ resume: "", introVideo: "" });

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const validationMessage = validateRegistration({
      ...form,
      resume: form.role === "candidate" ? candidateLinks.resume : "",
      introVideo: form.role === "candidate" ? candidateLinks.introVideo : "",
    });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      if (!isFirebaseConfigured()) {
        setError("Firebase is not configured. Configure the NEXT_PUBLIC_FIREBASE_* values before creating an account.");
        return;
      }

      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), form.email.trim(), form.password);
      await updateProfile(credential.user, { displayName: form.name.trim() });
      const users = getUsers();
      users.push({
        id: credential.user.uid,
        name: form.name.trim(),
        email: credential.user.email || form.email.trim(),
        role: form.role,
        companyName: form.companyName || undefined,
        phone: form.phone || undefined,
        location: form.location || undefined,
        approved: form.role === "candidate",
        status: form.role === "candidate" ? "active" : "pending",
        resume: form.role === "candidate" ? candidateLinks.resume.trim() : "",
        introVideo: form.role === "candidate" ? candidateLinks.introVideo.trim() : "",
        createdAt: new Date().toISOString(),
      });
      writeUsers(users);

      setSession({ userId: credential.user.uid });
      router.push("/dashboard");
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <SiteBrand compact />
            </Link>
            <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition">
              <span>🏠</span> Home
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/?auth=signin" className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-cyan-300">Create account</p>
            <h1 className="text-4xl font-bold tracking-tight">Build a smarter hiring pipeline.</h1>
            <p className="mt-4 text-slate-300">
              This platform is designed for a private recruiter workflow: recruiter access is approval-based, and candidates can apply with their resume and intro video.
            </p>

            <div className="mt-8 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <p className="font-semibold text-white">For recruiters</p>
                <p className="mt-2 text-xs text-slate-300">Recruiter accounts are reviewed by the site owner before job posting is enabled.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <p className="font-semibold text-white">For candidates</p>
                <p className="mt-2">Upload your resume, profile links, and intro video to stand out to recruiters.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900 p-8">
             <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Full name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Password</label>
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) => handleChange("password", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Account type</label>
                  <select
                    value={form.role}
                    onChange={(event) => handleChange("role", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
                </div>
              </div>

              {form.role === "candidate" ? (
                <>
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
                    <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Candidate Links</p>
                    <p className="text-xs text-slate-400">Paste shareable HTTPS links from Google Drive, Dropbox, YouTube, or another file host. JobNest does not store large files.</p>
                     
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">Resume link (optional)</label>
                        <input
                          type="url"
                          value={candidateLinks.resume}
                          onChange={(e) => setCandidateLinks((current) => ({ ...current, resume: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                          placeholder="https://drive.google.com/..."
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">Intro video link (optional)</label>
                        <input
                          type="url"
                          value={candidateLinks.introVideo}
                          onChange={(e) => setCandidateLinks((current) => ({ ...current, introVideo: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                          placeholder="https://youtube.com/..."
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Recruiter profiles are reviewed using your name, company, phone, and email details.
                </p>
              )}

              {form.role === "recruiter" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Company name</label>
                    <input
                      value={form.companyName}
                      onChange={(event) => handleChange("companyName", event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="Acme Hiring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Phone</label>
                    <input
                      value={form.phone}
                      onChange={(event) => handleChange("phone", event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="+971500000000"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm text-slate-300">Location</label>
                <input
                  value={form.location}
                  onChange={(event) => handleChange("location", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  placeholder="Dubai, UAE"
                />
              </div>

              {form.role === "recruiter" ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Recruiter accounts require site owner approval before job posting is enabled.
                </div>
              ) : null}

              {error ? <p className="text-sm text-rose-400">{error}</p> : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                {form.role === "recruiter" ? "Request recruiter access" : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
