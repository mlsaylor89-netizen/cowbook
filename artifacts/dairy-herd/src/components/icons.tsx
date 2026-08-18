/**
 * Custom SVG icons not available in lucide-react.
 * Each component accepts a `className` prop so it's a drop-in
 * replacement for any Lucide icon.
 */

import React from 'react';

interface IconProps {
  className?: string;
}

/** Sperm cell — head + sinuous tail */
export function SpermIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Oval head */}
      <ellipse cx="7.5" cy="9" rx="4.5" ry="5.5" />
      {/* Sinuous tail extending right */}
      <path d="M12 9.5 C15 8 13.5 14 17 13.5 C20 13 21.5 16 22 17" />
    </svg>
  );
}

/** Calf (baby cow) face — head, ears, eyes, nostrils */
export function CalfIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Head */}
      <circle cx="12" cy="14" r="6.5" />
      {/* Left ear */}
      <ellipse cx="6" cy="8.5" rx="2.2" ry="2.8" />
      {/* Right ear */}
      <ellipse cx="18" cy="8.5" rx="2.2" ry="2.8" />
      {/* Eyes */}
      <circle cx="9.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      {/* Muzzle */}
      <ellipse cx="12" cy="17" rx="3" ry="1.8" />
      {/* Nostrils */}
      <circle cx="10.5" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
