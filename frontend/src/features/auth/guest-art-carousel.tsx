"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const guestArtwork = ["sauron.jpg", "balrog.jpg", "nazgul.jpg"];

export function GuestArtCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        (currentIndex + 1) % guestArtwork.length
      );
    }, 4_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {guestArtwork.map((image, index) => (
        <Image
          key={image}
          alt=""
          className={`object-cover object-center transition-[opacity,transform] duration-1000 ease-in-out ${
            index === activeIndex
              ? "scale-105 opacity-100"
              : "scale-110 opacity-0"
          }`}
          fill
          priority={index === 0}
          sizes="(min-width: 768px) 50vw, 100vw"
          src={`/images/${image}`}
        />
      ))}
    </div>
  );
}
