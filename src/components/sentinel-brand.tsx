import Image from "next/image";
import Link from "next/link";

export default function SentinelBrand({
  href = "/",
  iconSize = 32,
  textClassName = "text-base font-bold tracking-[0.18em]",
  className = "",
}: {
  href?: string;
  iconSize?: number;
  textClassName?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <Image
        src="/icon.svg"
        alt="Sentinel"
        width={iconSize}
        height={iconSize}
        priority
        className="shrink-0"
      />
      <span className={textClassName}>SENTINEL</span>
    </Link>
  );
}
