// src/components/ServiceCard.jsx
import Link from "next/link";
import { IconContext } from "react-icons";
import { useState } from "react";

export default function ServiceCard({ icon: Icon, title, description, href }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="bg-card bg-bg p-6 rounded-xl shadow-lg transition-transform hover:scale-105 hover:shadow-2xl relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ zIndex: show ? 20 : "auto" }}
    >
      <IconContext.Provider value={{ className: "text-accent text-4xl mb-4" }}>
        <Icon />
      </IconContext.Provider>

      <h3 className="text-xl text-fg dark:text-gray-100 font-semibold mb-2">{title}</h3>

      {!show && <p className="text-muted dark:text-gray-200">{description.split(".")[0]}.</p>}

      {show && <div className="mt-2 text-fg dark:text-gray-200">{description}</div>}

      {href && (
        <div className="mt-4">
          <Link
            href={href}
            className="text-primary underline underline-offset-4 hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Learn more
          </Link>
        </div>
      )}
    </div>
  );
}
