import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { JobNestReminderAutomation } from "@/components/jobnest-reminder-automation";
import { FirebaseAuthSync } from "@/components/firebase-auth-sync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobNest | Recruiter-first hiring platform",
  description: "Post jobs, review resumes, and collect intro videos from applicants in a recruiter-first workflow.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        <JobNestReminderAutomation />
        <FirebaseAuthSync />
        {children}
      </body>
    </html>
  );
}
