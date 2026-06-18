export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30 px-5 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <span className="mb-6 block text-lg font-semibold tracking-tight">
            PDF <span className="font-serif-italic">Editify</span>
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The future of document intelligence. Built for modern teams who value
            clarity over noise.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-16">
          <div>
            <h4 className="mb-6 font-mono text-[10px] uppercase tracking-widest">
              Product
            </h4>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li>
                <a href="/#tools" className="hover:text-foreground">
                  Tools
                </a>
              </li>
              <li>
                <a href="/#pricing" className="hover:text-foreground">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 font-mono text-[10px] uppercase tracking-widest">
              Legal
            </h4>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  DPA
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-20 flex max-w-7xl items-center justify-between border-t border-border pt-8 text-[10px] text-muted-foreground">
        <span>© 2026 PDF Editify Inc.</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Systems operational
        </span>
      </div>
    </footer>
  );
}
