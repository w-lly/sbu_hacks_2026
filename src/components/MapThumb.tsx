import type { CharterSummary } from "@/shared/types";
/** Small generated-world preview; never geographic map data. */
export function MapThumb({thumb}:{thumb:CharterSummary["thumbnail"]}) {
 return <svg viewBox="0 0 130 84" className="world-thumb h-[84px] w-[130px] shrink-0 border border-border" aria-label="Generated terrain preview">
 <path d="M0 12Q20 2 32 14T48 40Q30 61 0 51Z M76 3Q98 12 83 27T95 53L130 62V0Z" className="forest"/>
 <path d="M60 32Q72 40 60 57T70 84H49Q42 63 49 49T60 32Z" className="hills"/>
 <path d="M93 0Q77 20 97 38T92 84H107Q115 61 105 44T106 0Z" className="water"/>
 <path d="M18 66V44H65V22H105" className="fill-none stroke-rust" strokeWidth="3"/>
 {[ [18,66],[65,44],[105,22] ].map(([x=0,y=0],i)=><rect key={i} x={x-6} y={y-6} width="12" height="12" rx="2" className="fill-card stroke-ink"/>)}
 </svg>;
}
