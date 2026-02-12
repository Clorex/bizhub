"use client";

import { useEffect, useState } from "react";

const BRAND_ORANGE = "#FF2D00"; // your Tailwind biz.orange

export default function SplashIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // show only once per app session (prevents it from showing every page change)
    const alreadyShown = sessionStorage.getItem("mybizhub_splash_shown");
    if (alreadyShown) return;

    setShow(true);
    sessionStorage.setItem("mybizhub_splash_shown", "1");

    const t = setTimeout(() => setShow(false), 1000); // 1 second
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: BRAND_ORANGE,
        zIndex: 999999,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <img
        src="/splash/logo.png"
        alt="myBizHub"
        style={{
          width: "min(520px, 85vw)",
          height: "auto",
        }}
      />
    </div>
  );
}