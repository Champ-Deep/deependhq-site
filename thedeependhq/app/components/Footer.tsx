import { socialLinks } from "@/lib/content";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div
        className="dhq-container"
        style={{
          paddingTop: 40,
          paddingBottom: 40,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--color-text-primary)",
            }}
          >
            Sreedeep Surapaneni
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--color-text-secondary)",
            }}
          >
            &copy; {year} deependhq. All rights reserved.
          </p>
        </div>

        <nav
          aria-label="Social links"
          style={{ display: "flex", flexWrap: "wrap", gap: 20 }}
        >
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: 14,
                color: "var(--color-text-secondary)",
              }}
              className="dhq-footer-link"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <style>{`
        .dhq-footer-link:hover { color: var(--color-accent-primary) !important; }
      `}</style>
    </footer>
  );
}
