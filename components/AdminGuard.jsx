"use client";

import { useEffect, useState } from "react";

export default function AdminGuard({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    fetch("/api/admin/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.authenticated) {
          const next = `${location.pathname}${location.search}`;
          location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setState({ loading: false, user: data.user });
      })
      .catch(() => location.replace(`/admin/login?next=${encodeURIComponent(location.pathname)}`));
  }, []);

  if (state.loading) {
    return <section className="section"><div className="container-site max-w-xl"><div className="card bg-card-surface border border-subtle p-6 text-center"><p className="text-muted">Checking admin access…</p></div></div></section>;
  }
  return <>{children}</>;
}
