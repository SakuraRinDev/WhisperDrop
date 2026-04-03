export function Section({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`card space-y-4 ${wide ? "lg:col-span-2" : ""}`}>
      <h2
        className="font-display text-[15px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--text-section)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
