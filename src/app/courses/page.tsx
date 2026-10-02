"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SiteBrand } from "@/components/site-brand";
import {
  Course,
  CourseAccess,
  getCurrentUser,
  getCourses,
  getCourseAccess,
  subscribeToData,
  writeCourseAccess,
  writeCourses,
} from "@/lib/jobnest-data";
import { getFirebaseAuth, isFirebaseConfigured, readFirestoreCollection, uploadCourseFile } from "@/lib/firebase-client";

const emptyForm = {
  title: "", description: "", category: "", duration: "", level: "beginner" as Course["level"],
  accessType: "free" as Course["accessType"], paymentUrl: "", paymentInstructions: "",
  supportEmail: "", supportPhone: "", supportUrl: "",
  certificateUrl: "", certificateDetails: "",
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [accessRecords, setAccessRecords] = useState<CourseAccess[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCourses(getCourses());
      setCurrentUser(getCurrentUser());
    };
    const unsubscribe = subscribeToData(refresh);
    refresh();
    if (isFirebaseConfigured()) {
      void readFirestoreCollection<Course>("courses").then((records) => {
        setCourses(records);
      }).catch(() => setError("Courses could not be loaded. Please refresh and try again."));
    }
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured()) return;
    const ownedCourses = courses.filter((course) => course.authorId === currentUser.id);
    void Promise.all([
      readFirestoreCollection<CourseAccess>("courseAccess", { field: "learnerId", value: currentUser.id }),
      ...ownedCourses.map((course) => readFirestoreCollection<CourseAccess>("courseAccess", { field: "courseId", value: course.id })),
    ]).then((records) => {
      setAccessRecords(Array.from(new Map(records.flat().map((record) => [record.id, record])).values()));
    }).catch(() => setError("Course access records could not be loaded."));
  }, [currentUser, courses]);

  const visibleCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses.filter((course) =>
      !term || `${course.title} ${course.description} ${course.category}`.toLowerCase().includes(term),
    );
  }, [courses, search]);

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const authUser = isFirebaseConfigured() ? getFirebaseAuth().currentUser : null;
    if (!currentUser || !authUser) {
      setError("Please sign in before uploading a course.");
      return;
    }
    if (!form.title.trim() || form.description.trim().length < 20 || !form.category.trim() || !file) {
      setError("Add a title, category, description of at least 20 characters, and a PDF or video file.");
      return;
    }
    if (!form.duration.trim()) {
      setError("Add the expected learning period, such as 6 weeks or 20 hours.");
      return;
    }
    if (form.accessType === "paid") {
      try {
        const paymentUrl = new URL(form.paymentUrl.trim());
        if (!["http:", "https:"].includes(paymentUrl.protocol) || !form.paymentInstructions.trim()) throw new Error();
      } catch {
        setError("Paid courses need a valid external HTTPS payment link and payment details.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim()) || (!form.supportPhone.trim() && !form.supportUrl.trim())) {
        setError("Paid courses need a support email and at least one additional contact option (phone or support page).");
        return;
      }
      if (form.supportUrl.trim()) {
        try {
          const supportUrl = new URL(form.supportUrl.trim());
          if (!["http:", "https:"].includes(supportUrl.protocol)) throw new Error();
        } catch {
          setError("Support page or WhatsApp link must use http:// or https://.");
          return;
        }
      }
    }

    setUploading(true);
    try {
      const contentUrl = await uploadCourseFile(authUser.uid, file);
      const course: Course = {
        id: `course-${crypto.randomUUID()}`,
        authorId: authUser.uid,
        authorName: currentUser.name,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        duration: form.duration.trim(),
        level: form.level,
        accessType: form.accessType,
        paymentUrl: form.accessType === "paid" ? form.paymentUrl.trim() : undefined,
        paymentInstructions: form.accessType === "paid" ? form.paymentInstructions.trim() : undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        supportPhone: form.supportPhone.trim() || undefined,
        supportUrl: form.supportUrl.trim() || undefined,
        contentUrl,
        contentType: file.type,
        certificateUrl: form.certificateUrl.trim() || undefined,
        certificateDetails: form.certificateDetails.trim() || undefined,
        createdAt: new Date().toISOString(),
        status: "published",
      };

      writeCourses([course, ...getCourses()]);
      setForm(emptyForm);
      setFile(null);
      setMessage("Course uploaded and published successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Course upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const requestCourseAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentUser || !selectedCourse || !paymentReference.trim()) {
      setError("Add the payment reference or confirmation number.");
      return;
    }
    setRequestingAccess(true);
    try {
      const request: CourseAccess = {
        id: `access-${crypto.randomUUID()}`,
        courseId: selectedCourse.id,
        courseTitle: selectedCourse.title,
        authorId: selectedCourse.authorId,
        learnerId: currentUser.id,
        learnerName: currentUser.name,
        learnerEmail: currentUser.email,
        paymentReference: paymentReference.trim(),
        paymentNotes: paymentNotes.trim(),
        status: "pending",
        requestedAt: new Date().toISOString(),
      };
      writeCourseAccess([request, ...getCourseAccess()]);
      setAccessRecords((records) => [request, ...records]);
      setSelectedCourse(null);
      setPaymentReference("");
      setPaymentNotes("");
      setMessage("Payment confirmation submitted. The course uploader will review it and grant access.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit access request.");
    } finally {
      setRequestingAccess(false);
    }
  };

  const approveAccess = (record: CourseAccess, status: "approved" | "rejected") => {
    const updated = getCourseAccess().map((entry) =>
      entry.id === record.id ? { ...entry, status, approvedAt: status === "approved" ? new Date().toISOString() : undefined } : entry,
    );
    writeCourseAccess(updated);
    setAccessRecords(updated);
    setMessage(status === "approved" ? `${record.learnerName} can now access the course.` : "Access request rejected.");
  };

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between rounded-full border border-slate-200/80 bg-white/95 px-5 py-2.5 shadow-sm">
          <Link href="/" className="inline-flex"><SiteBrand compact /></Link>
          <nav className="flex items-center gap-2 text-xs font-bold">
            <Link href="/jobs" className="rounded-full bg-slate-100 px-3.5 py-2 text-slate-700 hover:bg-slate-200">Jobs</Link>
            {currentUser ? (
              <Link href="/dashboard" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sky-700">Dashboard</Link>
            ) : (
              <Link href="/signup" className="rounded-full bg-sky-600 px-4 py-2 text-white hover:bg-sky-500">Register Account</Link>
            )}
          </nav>
        </header>

        <section className="rounded-[2.25rem] border border-violet-100 bg-white p-7 shadow-[0_25px_80px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">JobNest Learning</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-5xl">Available Courses</h1>
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => document.getElementById("upload-course")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-cyan-400"
                  >
                    <span aria-hidden="true">↑</span>
                    Upload a course
                  </button>
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-cyan-400"
                  >
                    <span aria-hidden="true">↑</span>
                    Upload a course
                  </Link>
                )}
              </div>
              <p className="mt-3 text-slate-600">Choose a course to build skills, or share your own expertise with the JobNest community.</p>
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 md:max-w-sm" placeholder="Search courses by title..." />
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {visibleCourses.map((course) => (
              <article key={course.id} className="rounded-2xl border border-violet-100 bg-[#fbfaff] p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-violet-100 px-3 py-2 text-lg text-violet-700">▥</span>
                  <span className="text-xs font-bold uppercase text-violet-600">{course.level}</span>
                </div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{course.category}</p>
                <h2 className="mt-2 text-xl font-black text-slate-900">{course.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{course.description}</p>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>By <strong>{course.authorName}</strong></p>
                  <p>Learning period: <strong>{course.duration}</strong></p>
                  <p>{course.accessType === "paid" ? "Subscription / paid access" : "Free access"}</p>
                </div>
                {(course.supportEmail || course.supportPhone || course.supportUrl) && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-bold">Payment/access help</p>
                    {course.supportEmail && <a className="mt-1 block underline" href={`mailto:${course.supportEmail}`}>Email uploader: {course.supportEmail}</a>}
                    {course.supportPhone && <a className="mt-1 block underline" href={`tel:${course.supportPhone}`}>Call/message: {course.supportPhone}</a>}
                    {course.supportUrl && <a className="mt-1 block underline" href={course.supportUrl} target="_blank" rel="noreferrer">Open support contact</a>}
                  </div>
                )}
                {currentUser && (course.accessType === "free" || course.authorId === currentUser.id || accessRecords.some((record) => record.courseId === course.id && record.learnerId === currentUser.id && record.status === "approved")) ? (
                  <a href={course.contentUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500">Open course</a>
                ) : !currentUser ? (
                  <Link href="/signup" className="mt-5 inline-flex rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500">Sign in to access</Link>
                ) : accessRecords.some((record) => record.courseId === course.id && record.learnerId === currentUser?.id && record.status === "pending") ? (
                  <span className="mt-5 inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-700">Access pending review</span>
                ) : (
                  <button type="button" onClick={() => setSelectedCourse(course)} className="mt-5 inline-flex rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500">Confirm payment & request access</button>
                )}
                {accessRecords.some((record) => record.courseId === course.id && record.learnerId === currentUser?.id && record.status === "approved") && course.certificateDetails && (
                  <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">Certificate: {course.certificateDetails} {course.certificateUrl && <a className="font-bold underline" href={course.certificateUrl} target="_blank" rel="noreferrer">View certificate</a>}</p>
                )}
              </article>
            ))}
          </div>

          {visibleCourses.length === 0 && (
            <div className="py-20 text-center">
              <div className="text-5xl text-slate-400">▱</div>
              <h2 className="mt-5 text-xl font-black">No Courses Available</h2>
              <p className="mt-2 text-slate-500">Check back later for new courses to explore.</p>
            </div>
          )}
        </section>

        {currentUser && (
          <section id="upload-course" className="scroll-mt-6 mt-8 rounded-[2rem] border border-slate-200 bg-slate-950 p-7 text-white sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">For educators and experts</p>
            <h2 className="mt-2 text-3xl font-black">Upload your course</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Publish a PDF lesson or video course for candidates and recruiters. Course files are limited to 50 MB.</p>
            <form onSubmit={handleUpload} className="mt-6 grid gap-4 md:grid-cols-2">
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Course title" />
              <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Category, e.g. Interview skills" />
              <input required value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Learning period, e.g. 6 weeks" />
              <select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as Course["level"] })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400">
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
              <select value={form.accessType} onChange={(event) => setForm({ ...form, accessType: event.target.value as Course["accessType"] })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400">
                <option value="free">Free course</option><option value="paid">Paid / subscription course</option>
              </select>
              {form.accessType === "paid" && (
                <>
                  <input required value={form.paymentUrl} onChange={(event) => setForm({ ...form, paymentUrl: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="External payment link" />
                  <input required value={form.paymentInstructions} onChange={(event) => setForm({ ...form, paymentInstructions: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Payment instructions and price" />
                  <input required type="email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Support email for payment/access issues" />
                  <input value={form.supportPhone} onChange={(event) => setForm({ ...form, supportPhone: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Phone or WhatsApp number (one extra option required)" />
                  <input value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Support page or WhatsApp link (alternative extra option)" />
                </>
              )}
              <input required type="file" accept=".pdf,video/mp4,video/webm,video/quicktime" onChange={(event) => setFile(event.target.files?.[0] || null)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300" />
              <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-28 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 md:col-span-2" placeholder="Describe what learners will gain (at least 20 characters)" />
              <input value={form.certificateUrl} onChange={(event) => setForm({ ...form, certificateUrl: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Certificate link (optional)" />
              <input value={form.certificateDetails} onChange={(event) => setForm({ ...form, certificateDetails: event.target.value })} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Certificate details, issuer, criteria" />
              <button disabled={uploading} type="submit" className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60 md:col-span-2">{uploading ? "Uploading..." : "Upload and publish course"}</button>
            </form>
            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
          </section>
        )}

        {selectedCourse && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4">
            <form onSubmit={requestCourseAccess} className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
              <h2 className="text-2xl font-black">Confirm access: {selectedCourse.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{selectedCourse.paymentInstructions || "Complete payment using the external link, then enter your confirmation details."}</p>
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-bold">Payment completed but access is delayed?</p>
                {selectedCourse.supportEmail && <a className="mt-1 block underline" href={`mailto:${selectedCourse.supportEmail}`}>Email: {selectedCourse.supportEmail}</a>}
                {selectedCourse.supportPhone && <a className="mt-1 block underline" href={`tel:${selectedCourse.supportPhone}`}>Phone/WhatsApp: {selectedCourse.supportPhone}</a>}
                {selectedCourse.supportUrl && <a className="mt-1 block underline" href={selectedCourse.supportUrl} target="_blank" rel="noreferrer">Support contact page</a>}
              </div>
              {selectedCourse.paymentUrl && <a href={selectedCourse.paymentUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Open external payment page</a>}
              <input required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" placeholder="Payment reference / transaction ID" />
              <textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" placeholder="Additional confirmation details (optional)" />
              <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setSelectedCourse(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button><button disabled={requestingAccess} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{requestingAccess ? "Submitting..." : "Submit for approval"}</button></div>
            </form>
          </div>
        )}

        {currentUser && accessRecords.some((record) => record.authorId === currentUser.id && record.status === "pending") && (
          <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-7">
            <h2 className="text-2xl font-black text-slate-900">Learner access requests</h2>
            <p className="mt-2 text-sm text-slate-600">Review external payment confirmations and grant access when your process is complete.</p>
            <div className="mt-5 space-y-3">
              {accessRecords.filter((record) => record.authorId === currentUser.id && record.status === "pending").map((record) => (
                <div key={record.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-bold">{record.learnerName} · {record.courseTitle}</p><p className="text-xs text-slate-500">{record.learnerEmail} · Payment: {record.paymentReference}</p><p className="text-xs text-slate-500">{record.paymentNotes}</p></div>
                  <div className="flex gap-2"><button type="button" onClick={() => approveAccess(record, "rejected")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Reject</button><button type="button" onClick={() => approveAccess(record, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Grant access</button></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
