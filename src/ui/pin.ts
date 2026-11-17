// PIN local opcional para alternar para o modo responsável neste aparelho.
// É apenas uma conveniência de interface: a autorização real é feita no banco (papéis + RLS).
const KEY = 'rb:pin';
const hash = async (pin: string) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('reino-bianca:' + pin));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'plain:' + pin;
  }
};
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const hasPin = () => !!read();
export async function setPin(pin: string | null) {
  try {
    if (!pin) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, await hash(pin));
  } catch { /* armazenamento indisponível */ }
}
export async function checkPin(pin: string) {
  const h = read();
  return !h || h === (await hash(pin));
}
