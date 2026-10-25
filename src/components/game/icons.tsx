import { Pickaxe, Fuel, Trees, Layers, PanelsTopLeft, Cog, Flame, Axe, Factory, Ship } from 'lucide-react';
import type { Commodity, CompanyKind } from '@/shared/factory';
import { STEAM_ART } from '@/game/render/steam-art';
export const GOOD_ICONS={iron:Pickaxe,coal:Fuel,timber:Trees,steel:Layers,planks:PanelsTopLeft,machinery:Cog};
export const BUILDING_ICONS={foundry:Flame,sawmill:Axe,works:Factory,exporter:Ship};
export function ArtIcon({kind,size=18}:{kind:keyof typeof STEAM_ART;size?:number}){return <img src={STEAM_ART[kind]} width={size} height={size} className={`steam-icon steam-icon-${kind}`} alt="" aria-hidden="true" draggable={false}/>;}
export function GoodIcon({good,size=18}:{good:Commodity;size?:number}){return <ArtIcon kind={good} size={size}/>;}
export function BuildingIcon({kind,size=28}:{kind:CompanyKind;size?:number}){const Icon=BUILDING_ICONS[kind];return <Icon size={size}/>;}