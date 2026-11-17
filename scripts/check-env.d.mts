export function checkEnv(env: Record<string, string | undefined>): { mode: 'demo' | 'cloud' | 'invalid'; errors: string[]; warnings: string[] };
