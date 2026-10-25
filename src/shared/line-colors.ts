/** Ordered CSS token bank shared by route controls and the canvas renderer. */
export const LINE_COLOR_TOKENS = Array.from({ length: 30 }, (_, index) => `--route-${index}`);
export const lineColorIndex = (index: number) => ((index % 30) + 30) % 30;
export const lineColorClass = (index: number) => `route-${lineColorIndex(index)}`;