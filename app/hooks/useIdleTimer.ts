"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseIdleTimerOptions {
  warningTimeout: number;
  logoutTimeout: number;
  onWarning: (expiresAt: number) => void;
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
  const warningAtRef = useRef(0);
  const expiresAtRef = useRef(0);
  const warningVisibleRef = useRef(false);
  const logoutTriggeredRef = useRef(false);
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

  const logoutNow = useCallback(() => {
    if (logoutTriggeredRef.current) return;

    logoutTriggeredRef.current = true;
    warningVisibleRef.current = false;
    clearTimers();
    onLogoutRef.current();
  }, [clearTimers]);

  const checkDeadlines = useCallback(() => {
    const now = Date.now();
    const expiresAt = expiresAtRef.current;

    if (!expiresAt) return;

    if (now >= expiresAt) {
      logoutNow();
      return;
    }

    if (
      now >= warningAtRef.current &&
      !warningVisibleRef.current &&
      !logoutTriggeredRef.current
    ) {
      warningVisibleRef.current = true;
      onWarningRef.current(expiresAt);
    }
  }, [logoutNow]);

  const resetTimer = useCallback(() => {
    clearTimers();

    const now = Date.now();
    const warningAt = now + warningTimeout;
    const expiresAt = warningAt + logoutTimeout;

    warningAtRef.current = warningAt;
    expiresAtRef.current = expiresAt;
    warningVisibleRef.current = false;
    logoutTriggeredRef.current = false;

    warningTimerRef.current = setTimeout(checkDeadlines, warningTimeout);
    logoutTimerRef.current = setTimeout(logoutNow, warningTimeout + logoutTimeout);
  }, [
    checkDeadlines,
    clearTimers,
    logoutNow,
    logoutTimeout,
    warningTimeout,
  ]);

  useEffect(() => {
    let lastHandledActivity = 0;

    const handleActivity = () => {
      if (warningVisibleRef.current || logoutTriggeredRef.current) return;

      const now = Date.now();
      if (now - lastHandledActivity < 1_000) return;

      lastHandledActivity = now;
      resetTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDeadlines();
      }
    };

    resetTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkDeadlines, clearTimers, resetTimer]);

  return { resetTimer, logoutNow };
}
