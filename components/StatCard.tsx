export function StatCard({ value, label, sub, onClick }: { value: string; label: string; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
      {onClick && <span className="chev" aria-hidden="true">›</span>}
    </>
  );
  return onClick ? (
    <button className="stat tappable" onClick={onClick} aria-label={`${label}: ${value}. Show details`}>{inner}</button>
  ) : (
    <div className="stat">{inner}</div>
  );
}
