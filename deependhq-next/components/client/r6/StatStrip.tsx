"use client";
// StatStrip : port of MobileStatStrip from the round 5 Rails.jsx. The compact
// horizontal proof-numbers strip shown under the nav on mobile. The desktop
// rails are custom in this app (components/client/home/Rails.tsx), so only
// the mobile strip is ported. Stats are computed server-side and passed in.

export interface OnRepeat {
  track: string;
  artist: string;
}

export interface StatStripProps {
  days: number;
  ships: number;
  companies: number;
  essays: number;
  onRepeat?: OnRepeat | null;
}

export function OnRepeatChip({ r }: { r?: OnRepeat | null }) {
  if (!r) return null;
  return (
    <span className="dh5-onrepeat" title="on repeat">
      <span className="dh5-eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <span className="tr">{r.track} · {r.artist}</span>
    </span>
  );
}

export function StatStrip({ days, ships, companies, essays, onRepeat }: StatStripProps) {
  return (
    <div className="dh5-statstrip" aria-label="proof numbers">
      <span><b>{days}</b> days</span>
      <span><b>{ships}</b> ships this month</span>
      <span><b>{companies}</b> companies</span>
      <span><b>{essays}</b> essays</span>
      <OnRepeatChip r={onRepeat} />
    </div>
  );
}
