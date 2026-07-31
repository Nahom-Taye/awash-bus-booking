"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const FAQ_IDS = ["1", "2", "3", "4", "5"] as const;

export default function FAQSection() {
  const t = useTranslations("home.faq");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="awash-container grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <p className="awash-section-label">{t("eyebrow")}</p>
          <h2 className="mt-3 max-w-lg text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-lg leading-7 text-stone-600">
            {t("description")}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {FAQ_IDS.map((id, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${id}`;

            return (
              <article
                key={id}
                className={index > 0 ? "border-t border-stone-200" : ""}
              >
                <h3>
                  <button
                    type="button"
                    aria-controls={answerId}
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left font-semibold text-stone-900 transition hover:bg-orange-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-awash-orange sm:px-6"
                  >
                    <span>{t(`q${id}`)}</span>
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-lg font-medium text-awash-orange"
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                {isOpen && (
                  <div id={answerId} className="px-5 pb-5 sm:px-6 sm:pb-6">
                    <p className="max-w-2xl leading-7 text-stone-600">
                      {t(`a${id}`)}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
