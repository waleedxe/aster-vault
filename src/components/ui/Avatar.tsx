import { cx } from "../../lib/cx";

const COLORS = [
  "bg-emerald text-white",
  "bg-[#4a6fa5] text-white",
  "bg-[#7a5ca8] text-white",
  "bg-[#b5573f] text-white",
  "bg-[#2f7d8a] text-white",
  "bg-[#a2762f] text-white",
];

function hash(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    total = (total * 31 + value.charCodeAt(i)) >>> 0;
  }
  return total;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

interface AvatarProps {
  /** Item title or domain used to derive the monogram. */
  name: string;
  /** Optional image URL (used later for favicons). */
  src?: string;
  size?: number;
  className?: string;
}

/** Rounded monogram avatar for an item. */
export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  const color = COLORS[hash(name) % COLORS.length];
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control font-semibold",
        !src && color,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
