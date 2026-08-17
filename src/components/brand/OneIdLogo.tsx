/**
 * OneIdLogo.tsx
 *
 * Renders the EXACT official OneID brand logo image provided by the user,
 * with 100% background transparency and clean crisp rendering across all screen sizes.
 */

export function OneIdMark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const height = {
    sm: "h-6 sm:h-7",
    md: "h-8 sm:h-9",
    lg: "h-11 sm:h-12",
    xl: "h-16 sm:h-20",
  }[size];

  return (
    <img
      src="/oneid_official_logo.png"
      alt="OneID"
      className={`w-auto object-contain drop-shadow-sm ${height} ${className}`}
    />
  );
}

export function OneIdLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}) {
  const height = {
    sm: "h-7 sm:h-8",
    md: "h-9 sm:h-10",
    lg: "h-12 sm:h-14",
    xl: "h-16 sm:h-20",
  }[size];

  return (
    <div className={`inline-flex items-center shrink-0 select-none ${className}`}>
      <img
        src="/oneid_official_logo.png"
        alt="one ID"
        className={`w-auto object-contain drop-shadow-sm ${height}`}
      />
    </div>
  );
}
