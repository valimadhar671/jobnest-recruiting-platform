export function SiteBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={[
          "flex items-center justify-center rounded-lg bg-slate-950 text-white font-black tracking-tighter shadow-sm",
          compact ? "h-8 w-8 text-sm" : "h-9 w-9 text-base",
        ].join(" ")}
      >
        <span className="bg-gradient-to-br from-sky-400 to-cyan-200 bg-clip-text text-transparent">
          JN
        </span>
      </div>
      <div>
        <div className={compact ? "text-base font-extrabold tracking-tight text-slate-900" : "text-lg font-black tracking-tight text-slate-900"}>
          Job<span className="text-sky-600">Nest</span>
        </div>
      </div>
    </div>
  );
}
