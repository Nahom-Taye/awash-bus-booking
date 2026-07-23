"use client";

import { useState } from "react";

const FAQS = [
  {
    question: "How do I book a ticket?",
    answer:
      "Search for your trip, select a seat, enter passenger details, and confirm your booking. You must be logged in to book.",
  },
  {
    question: "Can I cancel a booking?",
    answer:
      "Currently bookings cannot be cancelled online. Please contact our offices directly for cancellations.",
  },
  {
    question: "How do I pay?",
    answer:
      "Payment is currently handled at the ticketing office. Online payment via Telebirr and CBE Birr is coming soon.",
  },
  {
    question: "How early should I arrive?",
    answer:
      "We recommend arriving at least 30 minutes before your scheduled departure time.",
  },
  {
    question: "Can I book for multiple passengers?",
    answer:
      "Yes. You can book up to 6 seats in a single transaction, with individual details for each passenger.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white px-6 py-20">
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="text-center text-3xl font-bold text-awash-black">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-awash-grey-dark">
          Helpful answers for planning and booking your journey.
        </p>

        <div className="mt-10 space-y-3">
          {FAQS.map((item, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;

            return (
              <article
                key={item.question}
                className={`overflow-hidden rounded-lg border border-awash-grey bg-white transition ${
                  isOpen
                    ? "border-l-4 border-l-awash-orange shadow-sm"
                    : "border-l-4 border-l-transparent"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    aria-controls={answerId}
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-awash-black transition hover:bg-awash-orange-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-awash-orange"
                  >
                    <span>{item.question}</span>
                    <span
                      aria-hidden="true"
                      className={`text-awash-orange transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>
                </h3>

                <div
                  id={answerId}
                  className={`grid transition-[grid-template-rows] duration-200 ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 leading-7 text-awash-grey-dark">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
