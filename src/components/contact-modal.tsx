"use client";

import { useState } from "react";
import { OWNER_CONTACT } from "@/lib/jobnest-data";

interface ContactSupportButtonProps {
  variant?: "button" | "link" | "compact";
  className?: string;
}

export function ContactSupportButton({ variant = "button", className = "" }: ContactSupportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "compact" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:underline ${className}`}
        >
          <span>📞</span> Contact Support
        </button>
      ) : variant === "link" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`text-xs text-slate-400 hover:text-cyan-300 transition underline underline-offset-4 ${className}`}
        >
          Platform Owner & Support Details
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20 hover:border-cyan-500/50 ${className}`}
        >
          <span>📞</span> Contact Support & Owner
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold">
                  📞
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">Platform Owner Support</h3>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">JobNest Verified Contact</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono uppercase text-slate-400">Support Email</p>
                <a
                  href={`mailto:${OWNER_CONTACT.email}`}
                  className="text-sm font-bold text-cyan-300 hover:underline mt-0.5 block truncate"
                >
                  {OWNER_CONTACT.email}
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="text-[10px] font-mono uppercase text-slate-400">Direct Phone Numbers</p>
                <div className="mt-1 space-y-1">
                  {OWNER_CONTACT.phoneNumbers.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="text-sm font-bold text-white hover:text-cyan-300 transition block"
                    >
                      📱 {phone}
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">
                ⚡ For urgent recruiter approvals or domain authorization assistance, feel free to reach out via phone or email directly.
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
              >
                Close Support Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
