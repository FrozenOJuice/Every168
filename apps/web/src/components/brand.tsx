import Link from "next/link";

/** One accessible lockup for navigation and account access. */
export function BrandLink() {
  return (
    <Link href="/" className="brand" aria-label="Every168 home">
      {/* A local vector mark needs no image optimization or external font. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark.svg"
        className="brand-mark"
        width={32}
        height={32}
        alt=""
        aria-hidden="true"
      />
      <span>
        Every<span className="brand-number">168</span>
      </span>
    </Link>
  );
}
