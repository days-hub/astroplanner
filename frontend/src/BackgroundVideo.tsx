// src/BackgroundVideo.tsx
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  targetName?: string | null;
  cycle?: boolean;
};
const GLOBAL_PLAYLIST = [
  "/videos/global/Andromeda_1.mp4",
  "/videos/global/Andromeda_2.mp4",
  "/videos/global/Black_hole.mp4",
  "/videos/global/Exo_planet.mp4",
  "/videos/global/Orion_nebula.mp4",
  "/videos/global/Stars.mp4",
];
const VIDEO_LIBRARY: Record<string, string[]> = {
  global: [
    "/videos/global/Stars.mp4",
    "/videos/global/Black_hole.mp4",
    "/videos/global/Exo_planet.mp4",
    "/videos/global/Andromeda_1.mp4",
    "/videos/global/Andromeda_2.mp4",
  ],
  uranus: ["/videos/uranus/Uranus_1.mp4", "/videos/uranus/Uranus_2.mp4"],
  neptune: ["/videos/neptune/Neptune_1.mp4", "/videos/neptune/Neptune_2.mp4"],
  saturn: ["/videos/saturn/Saturn_1.mp4", "/videos/saturn/Saturn_2.mp4"],
  jupiter: ["/videos/jupiter/Jupiter_1.mp4", "/videos/jupiter/Jupiter_2.mp4"],
  mars: ["/videos/mars/Mars_1.mp4", "/videos/mars/Mars_2.mp4"],
  mercury: ["/videos/mercury/Mercury_1.mp4", "/videos/mercury/Mercury_2.mp4"],
  venus: ["/videos/venus/Venus_1.mp4", "/videos/venus/Venus_2.mp4"],
  moon: ["/videos/moon/Moon_1.mp4", "/videos/moon/Moon_2.mp4"],
  orion_nebula: ["/videos/global/Orion_nebula.mp4"],
  andromeda: ["/videos/global/Andromeda_1.mp4", "/videos/global/Andromeda_2.mp4"],
  pleiades: ["/videos/global/Stars.mp4"],
};

function targetToKey(targetName?: string | null): string {
  const s = (targetName ?? "").toLowerCase();

  if (s.includes("uranus")) return "uranus";
  if (s.includes("neptune")) return "neptune";
  if (s.includes("saturn")) return "saturn";
  if (s.includes("jupiter")) return "jupiter";
  if (s.includes("mars")) return "mars";
  if (s.includes("mercury")) return "mercury";
  if (s.includes("venus")) return "venus";
  if (s.includes("moon")) return "moon";

  if (s.includes("orion nebula") || s.includes("m42")) return "orion_nebula";
  if (s.includes("andromeda") || s.includes("m31")) return "andromeda";
  if (s.includes("pleiades") || s.includes("m45")) return "pleiades";

  return "global";
}

export default function BackgroundVideo({ targetName, cycle = false }: Props) {
  const key = useMemo(() => targetToKey(targetName), [targetName]);

  // If you want login to "cycle through global folder", pass cycle on that page.
  const videos = useMemo(() => {
    const list = cycle
      ? GLOBAL_PLAYLIST
      : (VIDEO_LIBRARY[key] ?? VIDEO_LIBRARY.global);
    return list.length ? list : VIDEO_LIBRARY.global;
  }, [cycle, key]);

  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [key, cycle]);

  const src = videos[index % videos.length];

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <video
        key={src}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setIndex((i) => i + 1)}
        onError={() => setIndex((i) => i + 1)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 1,      // <- was 0.75
          filter: "none",  // <- remove tinting
        }}
      />
      {/* REMOVE the readability overlay div entirely */}
    </div>
  );
}

