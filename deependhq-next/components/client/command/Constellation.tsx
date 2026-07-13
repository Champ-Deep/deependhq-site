"use client";
// Constellation : the ecosystem graph. Port of Constellation, CompanyDrill and
// ConstellationSVGInner from CommandPage.jsx. Uses the force-graph CDN global
// when it arrives (draggable canvas graph), otherwise falls back to the
// orbiting SVG constellation. Company data comes in as serializable props.

import { useEffect, useMemo, useRef, useState } from "react";
import { ACCENTS, whenReady, type FGNode, type ForceGraphInstance } from "./flair";

export interface ConstellationCompany {
  name: string;
  desc: string;
  tag?: string;
  products?: string[];
}

interface SvgNode extends ConstellationCompany {
  x: number;
  y: number;
  color: string;
  dur: string;
  delay: string;
}

interface SvgTip {
  x: number;
  y: number;
  n: SvgNode;
}

const ConstellationSVGInner = ({
  companies,
  onSelect,
}: {
  companies: ConstellationCompany[];
  onSelect?: (n: SvgNode) => void;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<SvgTip | null>(null);
  const VW = 800,
    VH = 460,
    cx = 400,
    cy = 230,
    rx = 320,
    ry = 168;
  const nodes = useMemo<SvgNode[]>(
    () =>
      (companies || []).map((co, i) => {
        const n = Math.max(companies.length, 1);
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        return {
          ...co,
          x: cx + rx * Math.cos(ang),
          y: cy + ry * Math.sin(ang),
          color: ACCENTS[i % 3],
          dur: (6 + (i % 5)).toFixed(1) + "s",
          delay: (-(i * 0.6)).toFixed(1) + "s",
        };
      }),
    [companies]
  );
  return (
    <div
      className="cc-constellation"
      onMouseLeave={() => {
        setHover(null);
        setTip(null);
      }}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ecosystem of companies">
        {nodes.map((n, i) => (
          <line
            key={"e" + i}
            className="cc-edge"
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            style={{ opacity: hover === null ? 0.3 : hover === i ? 0.85 : 0.08 }}
          />
        ))}
        <g>
          <circle className="cc-node-hub" cx={cx} cy={cy} r="34" />
          <text x={cx} y={cy - 2} className="cc-node-lab" style={{ fill: "#E8E4DC", fontSize: 13 }}>
            deep
          </text>
          <text x={cx} y={cy + 13} className="cc-node-lab" style={{ fill: "#30E060", fontSize: 13 }}>
            {">_"}
          </text>
        </g>
        {nodes.map((n, i) => (
          <g
            key={i}
            className="cc-node-g cc-float"
            style={{ "--cc-dur": n.dur, animationDelay: n.delay, cursor: "pointer" } as React.CSSProperties}
            onMouseEnter={(e) => {
              setHover(i);
              setTip({ x: e.clientX, y: e.clientY, n });
            }}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, n })}
            onClick={() => onSelect && onSelect(n)}
          >
            <circle
              className="cc-node"
              cx={n.x}
              cy={n.y}
              r={hover === i ? 11 : 7}
              fill={n.color}
              style={{ filter: `drop-shadow(0 0 7px ${n.color})` }}
            />
            <text className="cc-node-lab" x={n.x} y={n.y + 24}>
              {n.name}
            </text>
          </g>
        ))}
      </svg>
      {tip && (
        <div className="cc-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="cc-tip-day">{tip.n.tag || "venture"}</div>
          <div className="cc-tip-text">
            <b style={{ color: "#E8E4DC" }}>{tip.n.name}</b>
            <br />
            {tip.n.desc}
          </div>
        </div>
      )}
    </div>
  );
};

const CompanyDrill = ({ company, onClose }: { company: ConstellationCompany; onClose: () => void }) => (
  <div className="cc-drill">
    <button className="cc-drill-close" onClick={onClose} aria-label="close">
      ✕
    </button>
    <div className="cc-drill-tag">{company.tag || "venture"}</div>
    <div className="cc-drill-name">{company.name}</div>
    <p className="cc-drill-desc">{company.desc}</p>
    {company.products && company.products.length > 0 ? (
      <div className="cc-drill-chips">
        <span className="cc-drill-k">builds</span>
        {company.products.map((p) => (
          <span key={p} className="cc-drill-chip">
            {p}
          </span>
        ))}
      </div>
    ) : (
      <div className="cc-drill-chips">
        <span className="cc-drill-k">part of</span>
        <span className="cc-drill-chip">the 12-company operating system</span>
      </div>
    )}
  </div>
);

export function Constellation({ companies }: { companies: ConstellationCompany[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const [useFG, setUseFG] = useState(true);
  const [selected, setSelected] = useState<ConstellationCompany | null>(null);
  const byName = useMemo<Record<string, ConstellationCompany>>(() => {
    const m: Record<string, ConstellationCompany> = {};
    (companies || []).forEach((c) => {
      m[c.name] = c;
    });
    return m;
  }, [companies]);
  useEffect(() => {
    const el = elRef.current;
    let g: ForceGraphInstance | null = null;
    let cancelled = false;
    let onResize: (() => void) | null = null;
    whenReady(() => !!window.ForceGraph).then((ok) => {
      if (cancelled) return;
      if (!ok || !window.ForceGraph || !el) {
        setUseFG(false);
        return;
      }
      const nodes: FGNode[] = [
        { id: "__hub", name: "deep >_", hub: true },
        ...companies.map((c, i) => ({ id: c.name, name: c.name, desc: c.desc, tag: c.tag, col: ACCENTS[i % 3] })),
      ];
      const links = companies.map((c) => ({ source: "__hub", target: c.name }));
      try {
        const inst = window.ForceGraph()(el)
          .graphData({ nodes, links })
          .backgroundColor("rgba(0,0,0,0)")
          .width(el.clientWidth)
          .height(520)
          .nodeRelSize(6)
          .nodeVal((n) => (n.hub ? 9 : 3))
          .nodeLabel((n) => (n.hub ? "12 companies, one operating system" : `${n.name} · ${n.desc || ""}`))
          .linkColor(() => "rgba(74,123,247,0.22)")
          .linkWidth(1)
          .onNodeClick((n) => {
            if (n.hub) {
              setSelected(null);
              return;
            }
            const co = byName[n.name];
            if (co) setSelected(co);
          })
          .onBackgroundClick(() => setSelected(null))
          .nodeCanvasObjectMode(() => "replace")
          .nodeCanvasObject((n, ctx, scale) => {
            const r = n.hub ? 10 : 6;
            const x = n.x ?? 0;
            const y = n.y ?? 0;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.shadowColor = (n.hub ? "#30E060" : n.col) || "#30E060";
            ctx.shadowBlur = 12;
            ctx.fillStyle = (n.hub ? "#0D0F14" : n.col) || "#0D0F14";
            ctx.fill();
            ctx.shadowBlur = 0;
            if (n.hub) {
              ctx.lineWidth = 1.6;
              ctx.strokeStyle = "#30E060";
              ctx.stroke();
            }
            const fs = Math.max(9, 12 / scale);
            ctx.font = `${fs}px 'JetBrains Mono', monospace`;
            ctx.fillStyle = n.hub ? "#E8E4DC" : "#C9C7C0";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(n.hub ? "deep >_" : n.name, x, y + r + 5);
          })
          .onEngineStop(() => {
            try {
              inst.zoomToFit(500, 70);
            } catch {
              /* zoom is best-effort */
            }
          });
        g = inst;
        try {
          const charge = inst.d3Force("charge");
          if (charge && charge.strength) charge.strength(-280);
          const link = inst.d3Force("link");
          if (link && link.distance) link.distance(95);
          inst.d3VelocityDecay(0.28);
        } catch {
          /* force tuning is best-effort */
        }
      } catch {
        setUseFG(false);
        return;
      }
      onResize = () => {
        try {
          if (g) g.width(el.clientWidth);
        } catch {
          /* resize is best-effort */
        }
      };
      window.addEventListener("resize", onResize);
    });
    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener("resize", onResize);
      try {
        if (g && g._destructor) g._destructor();
        if (el) el.innerHTML = "";
      } catch {
        /* teardown is best-effort */
      }
    };
  }, [companies, byName]);
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">The ecosystem</h2>
        <span className="cc-sec-note">
          {(companies || []).length} companies, one operating system · click a node to drill in
        </span>
      </div>
      {useFG ? (
        <div ref={elRef} className="cc-forcegraph" />
      ) : (
        <ConstellationSVGInner
          companies={companies}
          onSelect={(n) => {
            const co = byName[n.name];
            if (co) setSelected(co);
          }}
        />
      )}
      {selected && <CompanyDrill company={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
