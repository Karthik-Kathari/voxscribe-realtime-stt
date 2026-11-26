interface VoxLogoProps {
  size?: "sm" | "md";
}

export function VoxLogo({ size = "sm" }: VoxLogoProps) {
  const dim = size === "md" ? "w-9 h-9" : "w-8 h-8";
  const svgSize = size === "md" ? 20 : 18;

  return (
    <span
      className={`${dim} rounded-lg bg-primary-container flex items-center justify-center border border-outline-variant shrink-0`}
      aria-hidden="true"
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="9" width="2.5" height="6" rx="1.25" fill="#EAE6FF" />
        <rect x="8.75" y="5" width="2.5" height="14" rx="1.25" fill="#89CEFF" />
        <rect x="13.5" y="3" width="2.5" height="18" rx="1.25" fill="#EAE6FF" />
        <rect x="18.25" y="8" width="2.5" height="8" rx="1.25" fill="#89CEFF" />
      </svg>
    </span>
  );
}

