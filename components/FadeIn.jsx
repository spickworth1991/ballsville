"use client";

import { motion } from "framer-motion";

export default function FadeIn({ children, className = "", delay = 0, duration = 0.35 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
