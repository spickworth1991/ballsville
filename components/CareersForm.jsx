"use client";

import { useState } from "react";

export default function CareersForm({ positions }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    position: "",
    file: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "file") {
      setForm((f) => ({ ...f, file: files?.[0] || null }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Hook up email / Supabase / Formspree/etc. here
    alert(
      `Thanks, ${form.name}! We received your application for “${form.position}”.` +
        (form.file ? ` File: ${form.file.name}` : "")
    );
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 focus:outline-none focus:ring-primary focus:ring-2 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-muted">Full Name</span>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          className={inputCls}
          required
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Email Address</span>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className={inputCls}
          required
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Position</span>
        <select
          name="position"
          value={form.position}
          onChange={handleChange}
          className={inputCls}
          required
        >
          <option value="">Select Position</option>
          {positions.map((pos, i) => (
            <option key={i} value={pos.title}>
              {pos.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-muted">Resume (PDF/DOC)</span>
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx"
          onChange={handleChange}
          className={inputCls}
          required
        />
      </label>

      <button type="submit" className="btn btn-primary rounded-full w-full">
        Submit Application
      </button>

      <p className="text-xs text-muted text-center">
        We value your privacy. Your information is used only for hiring.
      </p>
    </form>
  );
}
