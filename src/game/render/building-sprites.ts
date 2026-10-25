/** Replace any PNG independently; all sprites occupy the same 96px footprint. */
import foundry from '@/assets/building-foundry.png';
import sawmill from '@/assets/building-sawmill.png';
import works from '@/assets/building-works.png';
import exporter from '@/assets/supplied-shipping_depot.png';
import iron from '@/assets/supplied-iron_collector.png';
import coal from '@/assets/supplied-coal_collector.png';
import timber from '@/assets/supplied-wood_collector.png';
import transfer from '@/assets/building-transfer.png';
export const BUILDING_SPRITES: Record<string,string> = {foundry,sawmill,works,exporter:exporter,iron:iron,coal:coal,timber:timber,transfer};