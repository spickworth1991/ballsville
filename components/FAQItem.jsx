// components/FAQItem.jsx
"use client";

export default function FAQItem({ question, answer, defaultOpen = false }) {
  return (
    <details
      className="group border-b last:border-b-0 border-subtle"
      open={defaultOpen}
    >
      <summary
        className="
          cursor-pointer list-none
          flex items-start gap-3
          px-4 py-4
          hover:bg-card
        "
      >
        {/* Icon */}
        <span
          className="
            mt-1 inline-flex h-6 w-6 items-center justify-center
            rounded-full
            ring-subtle
          "
          aria-hidden="true"
        >
          <svg
            className="transition-transform duration-200 group-open:rotate-180"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </span>

        {/* Question */}
        <h3 className="font-semibold text-base sm:text-lg">{question}</h3>
      </summary>

      {/* Answer */}
      <div className="px-4 pb-4 text-muted">
        <p>{answer}</p>
      </div>
    </details>
  );
}
