"use client";
import Link from "next/link";

export default function RLink({ to, children, ...rest }) {
  return (
    <Link href={to} {...rest}>
      {children}
    </Link>
  );
}
