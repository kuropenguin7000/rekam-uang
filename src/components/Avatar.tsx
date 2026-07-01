"use client";

import { useState } from "react";

interface Props {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** tailwind size classes for the container, e.g. "h-9 w-9" */
  className?: string;
}

/**
 * User avatar. Renders the Google profile photo with `referrerPolicy=no-referrer`
 * — Google's `lh3.googleusercontent.com` images 403 when a referrer header is
 * sent — and falls back to the initial letter if the image fails or is absent.
 */
export function Avatar({ name, email, image, className = "h-9 w-9" }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold text-white ${className}`}
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}
