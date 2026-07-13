import Link from "next/link";

export default function NotFound() {
  return (
    <div className="dh-page" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <p className="dh-mono" style={{ color: "var(--color-accent-primary)", fontSize: "var(--text-h1)" }}>
          &gt;_ 404
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", margin: "12px 0" }}>This path does not exist.</h1>
        <p className="dh-muted" style={{ marginBottom: 24 }}>
          Not every experiment ships. This URL is one of them.
        </p>
        <Link className="dh-btn dh-btn-primary" href="/">
          Back to the surface
        </Link>
      </div>
    </div>
  );
}
