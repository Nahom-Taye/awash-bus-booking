"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { isEmail, normalizeEmail } from "@/lib/validation";

export default function ContactSection() {
  const t = useTranslations("home.contact");
  const tCommon = useTranslations("common");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = normalizeEmail(String(formData.get("email") ?? ""));
    const phone = String(formData.get("phone") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    if (!fullName || !email || !message) {
      setFeedback({ type: "error", message: t("validationRequired") });
      setSubmitting(false);
      return;
    }
    if (fullName.length < 2 || fullName.length > 120 || !isEmail(email)) {
      setFeedback({ type: "error", message: t("validationIdentity") });
      setSubmitting(false);
      return;
    }
    if (phone.length > 40 || subject.length > 160) {
      setFeedback({ type: "error", message: t("validationOptionalFields") });
      setSubmitting(false);
      return;
    }
    if (message.length < 10 || message.length > 2_000) {
      setFeedback({ type: "error", message: t("validationMessage") });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/contact/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          subject,
          message,
          website: formData.get("website"),
        }),
      });

      if (!response.ok) {
        throw new Error("CONTACT_SEND_FAILED");
      }

      setFeedback({ type: "success", message: t("success") });
      form.reset();
    } catch {
      setFeedback({
        type: "error",
        message: t("failure"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="contact"
      className="scroll-mt-24 border-y border-stone-200 bg-stone-100 py-20 sm:py-24"
    >
      <div className="awash-container grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="awash-section-label">{t("eyebrow")}</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-xl leading-7 text-stone-600">
            {t("description")}
          </p>

          <dl className="mt-9 space-y-5 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div>
              <dt className="text-sm font-semibold text-stone-500">
                {tCommon("phone")}
              </dt>
              <dd className="mt-1 text-stone-900">
                <a className="hover:text-awash-orange" href="tel:0905310000">
                  0905-310000
                </a>
                {", "}
                <a className="hover:text-awash-orange" href="tel:0905320000">
                  0905-320000
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-stone-500">
                {tCommon("email")}
              </dt>
              <dd className="mt-1">
                <a
                  className="text-stone-900 hover:text-awash-orange"
                  href="mailto:info@awashbus.com"
                >
                  info@awashbus.com
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-stone-500">
                {t("office")}
              </dt>
              <dd className="mt-1 text-stone-900">{t("officeValue")}</dd>
            </div>
          </dl>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="awash-card p-6 sm:p-8"
        >
          <div className="border-b border-stone-200 pb-5">
            <h3 className="text-xl font-bold text-stone-900">
              {t("formTitle")}
            </h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {t("formDescription")}
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <label className="awash-label">
              {t("name")}
              <input
                id="contact-name"
                name="fullName"
                type="text"
                required
                maxLength={120}
                placeholder={t("namePlaceholder")}
                className="awash-input"
              />
            </label>
            <label className="awash-label">
              {tCommon("phone")}{" "}
              <span className="font-normal text-stone-500">
                ({tCommon("optional")})
              </span>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                maxLength={40}
                placeholder={t("phonePlaceholder")}
                className="awash-input"
              />
            </label>
            <label className="awash-label">
              {t("subject")}{" "}
              <span className="font-normal text-stone-500">
                ({tCommon("optional")})
              </span>
              <input
                id="contact-subject"
                name="subject"
                type="text"
                maxLength={160}
                placeholder={t("subjectPlaceholder")}
                className="awash-input"
              />
            </label>
            <label className="awash-label">
              {tCommon("email")}
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder={t("emailPlaceholder")}
                className="awash-input"
              />
            </label>
            <div
              aria-hidden="true"
              className="absolute -left-[10000px] h-px w-px overflow-hidden"
            >
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <label className="awash-label">
              {t("message")}
              <textarea
                id="contact-message"
                name="message"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                placeholder={t("messagePlaceholder")}
                className="awash-input resize-y"
              />
            </label>
          </div>

          {feedback && (
            <p
              className={`mt-5 ${
                feedback.type === "success"
                  ? "awash-alert-success"
                  : "awash-alert-error"
              }`}
              role="status"
            >
              {feedback.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="awash-primary mt-6 w-full"
          >
            {submitting ? t("sending") : t("send")}
          </button>
        </form>
      </div>
    </section>
  );
}
