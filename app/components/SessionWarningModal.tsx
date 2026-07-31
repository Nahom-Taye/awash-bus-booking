"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface SessionWarningModalProps {
  isVisible: boolean;
  expiresAt: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export default function SessionWarningModal(
  props: SessionWarningModalProps,
) {
  if (!props.isVisible) return null;

  return <SessionWarningDialog {...props} />;
}

function SessionWarningDialog({
  expiresAt,
  onStayLoggedIn,
  onLogOut,
}: SessionWarningModalProps) {
  const t = useTranslations("session");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const remainingSeconds = Math.max(
    0,
    Math.ceil((expiresAt - currentTime) / 1_000),
  );
  const remainingLabel =
    remainingSeconds > 60
      ? t("minutesRemaining", {
          count: Math.ceil(remainingSeconds / 60),
        })
      : t("secondsRemaining", { count: remainingSeconds });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 px-4 backdrop-blur-[2px]"
      role="presentation"
    >
      <section
        aria-describedby="session-warning-description"
        aria-labelledby="session-warning-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
        role="dialog"
      >
        <h2
          id="session-warning-title"
          className="text-2xl font-bold text-awash-black"
        >
          {t("title")}
        </h2>
        <p
          id="session-warning-description"
          className="mt-3 leading-7 text-awash-grey-dark"
        >
          {t("description")}
        </p>
        <p
          aria-live="polite"
          className="mt-4 rounded-lg bg-orange-50 px-4 py-3 text-center text-lg font-bold text-awash-orange-dark"
        >
          {remainingLabel}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            autoFocus
            type="button"
            onClick={onStayLoggedIn}
            className="min-h-12 rounded-lg bg-awash-orange px-4 py-2.5 text-sm font-semibold leading-6 text-white transition hover:bg-awash-orange-dark focus:outline-none focus:ring-2 focus:ring-awash-orange focus:ring-offset-2"
          >
            {t("staySignedIn")}
          </button>
          <button
            type="button"
            onClick={onLogOut}
            className="min-h-12 rounded-lg border border-awash-error px-4 py-2.5 text-sm font-semibold leading-6 text-awash-error transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-awash-error focus:ring-offset-2"
          >
            {t("signOut")}
          </button>
        </div>
      </section>
    </div>
  );
}
