export const MAP_W: number;
export const MAP_H: number;
export function imageInfo(buf: Buffer, ext: string): { w: number; h: number; alpha: boolean; svgText?: string } | null;
export function unsafeSvgReason(text: string): string | null;
export function validateArt(o: { manifest: unknown; catalog: { catalog: any[] }; publicDir: string }): { errors: string[]; warnings: string[]; stats: { assets: number; bytes: number } };
