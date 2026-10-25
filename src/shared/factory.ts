/** Browser/server-safe recipe catalogue and freight contracts. */
export type Commodity = "iron" | "coal" | "timber" | "steel" | "planks" | "machinery";
export type RawMaterial = "iron" | "coal" | "timber";
export type Stock = Record<Commodity, number>;
export const RAW_MATERIALS: RawMaterial[] = ["iron", "coal", "timber"];
export const COMMODITIES: Commodity[] = [...RAW_MATERIALS, "steel", "planks", "machinery"];
export const GOODS: Record<Commodity, { label: string; symbol: string }> = {
  iron: { label: "Iron ore", symbol: "Fe" }, coal: { label: "Coal", symbol: "C" },
  timber: { label: "Timber", symbol: "T" }, steel: { label: "Steel", symbol: "St" },
  planks: { label: "Planks", symbol: "P" }, machinery: { label: "Machinery", symbol: "M" },
};
export type CompanyKind = "foundry" | "sawmill" | "works" | "exporter";
export interface Recipe { label: string; inputs: Partial<Stock>; output: Commodity | null; quantity: number }
export const RECIPES: Record<CompanyKind, Recipe> = {
  foundry: { label: "Steel Mill", inputs: { iron: 2, coal: 1 }, output: "steel", quantity: 2 },
  sawmill: { label: "Sawmill", inputs: { timber: 2 }, output: "planks", quantity: 2 },
  works: { label: "Machine Factory", inputs: { steel: 2, planks: 1 }, output: "machinery", quantity: 1 },
  exporter: { label: "Shipping Depot", inputs: { machinery: 1, planks: 1 }, output: null, quantity: 1 },
};
export const emptyStock = (): Stock => ({ iron: 0, coal: 0, timber: 0, steel: 0, planks: 0, machinery: 0 });
export interface FreightContract { id: number; company: number; good: Commodity; quantity: number; delivered: number; deadline: number; status: "open" | "complete" | "missed" }
