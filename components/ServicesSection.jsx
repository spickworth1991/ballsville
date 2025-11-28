// src/components/ServicesSection.jsx
"use client";

import { motion } from "framer-motion";
import ServiceCard from "./ServiceCard";
import { FaHands, FaDumbbell, FaRegLightbulb } from "react-icons/fa";
import { FaSyringe } from "react-icons/fa6";

const services = [
  {
    icon: FaHands,
    title: "Manual Therapy",
    description:
      "Joint mobilization, soft-tissue release, and myofascial techniques to relieve pain and restore motion.",
    href: "/services/manual-therapy",
    badge: "Hands-on",
  },
  {
    icon: FaSyringe,
    title: "Dry Needling",
    description:
      "Fine-gauge needles target trigger points to reduce pain, improve blood flow, and restore muscle function.",
    href: "/services/dry-needling",
    badge: "Rapid relief",
  },
  {
    icon: FaDumbbell,
    title: "Strength Training",
    description:
      "Progressive, functional plans to rebuild muscle, protect joints, and enhance performance.",
    href: "/services/strength-training",
    badge: "Performance",
  },
  {
    icon: FaRegLightbulb,
    title: "Education & Prevention",
    description:
      "Posture, ergonomics, and home programming tailored to your lifestyle and goals.",
    href: "/services/education-injury-prevention",
    badge: "Stay moving",
  },
];

export default function ServicesSection() {
  return (
    <section>
      <h2 className="h2 text-center mb-8">Our Services</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: i * 0.06 }}
          >
            <ServiceCard {...s} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
