"use client";

interface SessionWarningModalProps {
  isVisible: boolean;
  countdown: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export default function SessionWarningModal({
  isVisible,
  countdown,
  onStayLoggedIn,
  onLogOut,
}: SessionWarningModalProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="presentation"
    >
      <section
        aria-describedby="session-warning-description"
        aria-labelledby="session-warning-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border-l-4 border-awash-orange bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h2
          id="session-warning-title"
          className="text-2xl font-bold text-awash-black"
        >
          Session Expiring
        </h2>
        <p
          id="session-warning-description"
          className="mt-3 leading-7 text-awash-grey-dark"
        >
          You&apos;ve been inactive. You will be logged out in{" "}
          <strong className="text-awash-black">{countdown} seconds</strong> for
          security.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            autoFocus
            type="button"
            onClick={onStayLoggedIn}
            className="flex-1 rounded-lg bg-awash-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-awash-orange-dark focus:outline-none focus:ring-2 focus:ring-awash-orange focus:ring-offset-2"
          >
            Stay Logged In
          </button>
          <button
            type="button"
            onClick={onLogOut}
            className="flex-1 rounded-lg border border-awash-error px-4 py-2.5 text-sm font-semibold text-awash-error transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-awash-error focus:ring-offset-2"
          >
            Log Out Now
          </button>
        </div>
      </section>
    </div>
  );
}
