'use client';

import { useEffect } from "react";
import { startReminderAutomation, stopReminderAutomation } from "@/lib/jobnest-data";

export function JobNestReminderAutomation() {
  useEffect(() => {
    startReminderAutomation();
    return () => stopReminderAutomation();
  }, []);

  return null;
}
