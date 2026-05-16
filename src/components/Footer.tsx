export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-nothing-border">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-8 font-mono text-[11px] uppercase tracking-[0.06em] text-nothing-secondary">
        <span className="normal-case tracking-normal text-nothing-disabled">&copy; {year} Para Labs</span>
        <div className="flex gap-5">
          <a
            href="/feed.xml"
            className="transition-colors duration-200 ease-nothing hover:text-nothing-primary"
          >
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
