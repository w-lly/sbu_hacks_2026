import { Pickaxe, Fuel, Trees, Layers, PanelsTopLeft, Cog, Flame, Axe, Factory, Ship } from 'lucide-react';
import type { Commodity, CompanyKind } from '@/shared/factory';
export const GOOD_ICONS={iron:Pickaxe,coal:Fuel,timber:Trees,steel:Layers,planks:PanelsTopLeft,machinery:Cog};
export const BUILDING_ICONS={foundry:Flame,sawmill:Axe,works:Factory,exporter:Ship};
export function GoodIcon({good,size=18}:{good:Commodity;size?:number}){const Icon=GOOD_ICONS[good];return <Icon size={size}/>;}
export function BuildingIcon({kind,size=28}:{kind:CompanyKind;size?:number}){const Icon=BUILDING_ICONS[kind];return <Icon size={size}/>;}