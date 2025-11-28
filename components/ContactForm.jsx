// components/ContactForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function ContactForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErr("");

    try {
      const res = await fetch("https://formspree.io/f/mvgqnbkd", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(e.currentTarget),
      });

      if (res.ok) {
        router.push("/thanks");
      } else {
        setErr(
          "Something went wrong. Please try again or email info@stayinmotionpt.com."
        );
        setSubmitting(false);
      }
    } catch {
      setErr(
        "Network error. Please try again or email info@stayinmotionpt.com."
      );
      setSubmitting(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <label className="block">
        <span className="text-sm text-muted">Name</span>
        <input
          name="name"
          required
          value={form.name}
          onChange={handleChange}
          className="
            mt-1 w-full rounded-lg
            border border-subtle bg-transparent
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-primary
          "
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          value={form.email}
          onChange={handleChange}
          className="
            mt-1 w-full rounded-lg
            border border-subtle bg-transparent
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-primary
          "
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Subject</span>
        <input
          name="subject"
          value={form.subject}
          onChange={handleChange}
          className="
            mt-1 w-full rounded-lg
            border border-subtle bg-transparent
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-primary
          "
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Message</span>
        <textarea
          name="message"
          rows={5}
          value={form.message}
          onChange={handleChange}
          className="
            mt-1 w-full rounded-lg
            border border-subtle bg-transparent
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-primary
          "
        />
      </label>

      {/* Honeypot */}
      <input
        type="text"
        name="_gotcha"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      {/* Optional explicit subject for the email you receive */}
      <input type="hidden" name="_subject" value="New website inquiry" />

      <button
        disabled={submitting}
        className="btn btn-primary w-full disabled:opacity-60"
        type="submit"
      >
        {submitting ? "Sending..." : "Send Message"}
      </button>

      {err && <p className="text-sm text-danger">{err}</p>}

      <p className="text-sm text-muted mt-2">
        Please do not include personal medical details in this form. This form
        is for general inquiries only.
      </p>
    </motion.form>
  );
}
