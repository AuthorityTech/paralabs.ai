import Link from "next/link";
import ThemeNavButton from "@/components/ThemeNavButton";

export default function Nav() {
  return (
    <nav className="border-b border-nothing-border bg-nothing-surface/95">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-display text-[15px] font-medium tracking-[-0.01em] text-nothing-display transition-colors duration-200 ease-nothing hover:text-link"
          aria-label="Para Labs"
        >
          Para Labs
        </Link>
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.08em] text-nothing-secondary sm:gap-6">
            <Link href="/blog" className="transition-colors duration-200 ease-nothing hover:text-nothing-primary">
              Research
            </Link>
          </div>
          <ThemeNavButton />
        </div>
      </div>
    </nav>
  );
}
