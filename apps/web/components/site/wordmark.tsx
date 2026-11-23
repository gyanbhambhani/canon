/** "canon" in Geist Mono with the block caret in --fix: the brand mark. */
export function Wordmark({ size = "nav" }: { size?: "nav" | "footer" }) {
  const big = size === "nav";
  return (
    <span className={`inline-flex items-center gap-[3px] font-mono font-semibold tracking-[-0.03em] text-ink-strong ${big ? "text-[18px]" : "text-[16px]"}`}>
      canon
      <span aria-hidden className={`inline-block bg-fix ${big ? "h-[17px] w-[8px]" : "h-[15px] w-[7px]"}`} />
    </span>
  );
}
