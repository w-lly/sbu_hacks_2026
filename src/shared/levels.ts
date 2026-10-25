/** Device-local mock campaign rules; no user account or hosted progress. */
export const LEVELS = ['setauket', 'nassau', 'manhattan'] as const;
export const LEVEL_NAMES: Record<string,string> = {setauket:'Greenfield',nassau:'Highland',manhattan:'Frontier'};
export function levelUnlocked(slug:string,completed:readonly string[]) {
  const index=LEVELS.findIndex(s=>s===slug);
  return index===0 || (index>0 && completed.includes(LEVELS[index-1] ?? ''));
}
export function readCompleted():string[] {
  try { const data:unknown=JSON.parse(localStorage.getItem('factory-completed-levels') ?? '[]');return Array.isArray(data)?data.filter((s):s is string=>typeof s==='string'&&LEVELS.some(l=>l===s)):[]; } catch {return [];}
}
export function completeLevel(slug:string) {const done=readCompleted();if(!done.includes(slug))localStorage.setItem('factory-completed-levels',JSON.stringify([...done,slug]));}