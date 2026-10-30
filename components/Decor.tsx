export function Wave({
  top = false,
  color = "var(--cream)",
}: {
  top?: boolean;
  color?: string;
}) {
  return (
    <svg
      className={`wave ${top ? "wave-top" : ""}`}
      viewBox="0 0 1440 65"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill={color}
        d="M0 25Q40 5 80 25Q120 45 160 27Q200 9 240 25Q280 41 320 27Q360 13 400 25Q440 37 480 27Q520 17 560 25Q600 33 640 27Q680 21 720 25Q760 29 800 27Q840 25 880 17Q920 9 960 27Q1000 45 1040 25Q1080 5 1120 27Q1160 49 1200 25Q1240 1 1280 27Q1320 53 1360 25Q1400 3 1440 25V65H0Z"
      />
    </svg>
  );
}
export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`flower ${className}`}
      width="70"
      height="70"
      viewBox="0 0 70 70"
      aria-hidden="true"
    >
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="35"
          cy="19"
          rx="9"
          ry="17"
          fill="#f4c2a2"
          transform={`rotate(${a} 35 35)`}
        />
      ))}
      <circle cx="35" cy="35" r="7" fill="#cf955c" />
    </svg>
  );
}
