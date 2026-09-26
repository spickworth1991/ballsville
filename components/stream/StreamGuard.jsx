"use client";

import { useEffect, useState } from "react";

export default function StreamGuard({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    fetch("/api/stream/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.authenticated) {
          const next = `${location.pathname}${location.search}`;
          location.replace(`/stream?next=${encodeURIComponent(next)}`);
          return;
        }
        setState({ loading: false, user: data.user });
      })
      .catch(() => location.replace(`/stream?next=${encodeURIComponent(location.pathname)}`));
  }, []);

  if (state.loading) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-muted">Opening the stream room…</div>;
  return children(state.user);
}

