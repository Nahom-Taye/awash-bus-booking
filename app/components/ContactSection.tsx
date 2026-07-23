"use client";

import type { FormEvent } from "react";

export default function ContactSection() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <section id="contact" className="bg-awash-black px-6 py-20 text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-awash-gold">
            We&apos;re here to help
          </p>
          <h2 className="mt-3 text-3xl font-bold">Contact Us</h2>
          <p className="mt-4 max-w-lg leading-7 text-awash-grey-medium">
            Talk with our team about bookings, schedules, or anything else you
            need for your trip.
          </p>

          <dl className="mt-8 space-y-5">
            <div className="border-l-4 border-awash-orange pl-4">
              <dt className="text-sm font-semibold text-awash-gold">Phone</dt>
              <dd className="mt-1 text-awash-grey-light">
                <a className="transition hover:text-white" href="tel:0905310000">
                  0905-310000
                </a>
                {", "}
                <a className="transition hover:text-white" href="tel:0905320000">
                  0905-320000
                </a>
                {", "}
                <a className="transition hover:text-white" href="tel:0905330000">
                  0905-330000
                </a>
              </dd>
            </div>
            <div className="border-l-4 border-awash-orange pl-4">
              <dt className="text-sm font-semibold text-awash-gold">Email</dt>
              <dd className="mt-1">
                <a
                  className="text-awash-grey-light transition hover:text-white"
                  href="mailto:info@awashbus.com"
                >
                  info@awashbus.com
                </a>
              </dd>
            </div>
            <div className="border-l-4 border-awash-orange pl-4">
              <dt className="text-sm font-semibold text-awash-gold">Office</dt>
              <dd className="mt-1 text-awash-grey-light">
                Addis Ababa, Mexico Square, Ethiopia
              </dd>
            </div>
          </dl>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border-t-4 border-awash-orange bg-white p-6 text-awash-black shadow-xl sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                className="w-full rounded-lg border border-awash-grey-medium px-4 py-3 outline-none transition focus:border-awash-blue focus:ring-1 focus:ring-awash-blue"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-awash-grey-medium px-4 py-3 outline-none transition focus:border-awash-blue focus:ring-1 focus:ring-awash-blue"
              />
            </div>
            <div>
              <label
                htmlFor="contact-message"
                className="mb-2 block text-sm font-semibold"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                className="w-full resize-y rounded-lg border border-awash-grey-medium px-4 py-3 outline-none transition focus:border-awash-blue focus:ring-1 focus:ring-awash-blue"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-awash-orange px-5 py-3 font-semibold text-white transition hover:bg-awash-orange-dark focus:outline-none focus:ring-2 focus:ring-awash-orange focus:ring-offset-2"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
