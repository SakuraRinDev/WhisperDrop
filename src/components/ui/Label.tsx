export function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[15px] font-medium" style={{ color: "var(--text-secondary)" }}>{text}</label>
      {children}
    </div>
  );
}
