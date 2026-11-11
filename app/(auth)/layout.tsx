/** Centered, no navigation: used by the sign-in and sign-up pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark" aria-hidden="true">✈</span>
        <span>Wingmates</span>
      </div>
      <p className="auth-tag">Your flights, your spots, your crew.</p>
      {children}
    </main>
  );
}
