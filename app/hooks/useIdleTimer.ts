"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseIdleTimerOptions {
  warningTimeout: number;
  logoutTimeout: number;
  onWarning: () => void;
  onLogout: () => void;
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export function useIdleTimer({
  warningTimeout,
  logoutTimeout,
  onWarning,
  onLogout,
}: UseIdleTimerOptions) {
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningVisibleRef = useRef(false);
  const onWarningRef = useRef(onWarning);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onWarningRef.current = onWarning;
    onLogoutRef.current = onLogout;
  }, [onLogout, onWarning]);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    warningVisibleRef.current = false;

    warningTimerRef.current = setTimeout(() => {
      warningVisibleRef.current = true;
      onWarningRef.current();

      logoutTimerRef.current = setTimeout(() => {
        onLogoutRef.current();
      }, logoutTimeout);
    }, warningTimeout);
  }, [clearTimers, logoutTimeout, warningTimeout]);

  useEffect(() => {
    let lastHandledActivity = 0;

    const handleActivity = () => {
      if (warningVisibleRef.current) return;

      const now = Date.now();
      if (now - lastHandledActivity < 1_000) return;

      lastHandledActivity = now;
      resetTimer();
    };

    resetTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [clearTimers, resetTimer]);

  return { resetTimer };
}
