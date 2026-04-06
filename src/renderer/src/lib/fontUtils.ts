/**
 * Resolve a fontFamily value to a CSS font-family string.
 * Handles legacy 'serif'/'sans'/'mono' shortcuts and arbitrary installed font names.
 */
export function resolveFontFamily(fontFamily: string): string {
  switch (fontFamily) {
    case 'serif': return 'Lora, Georgia, "Times New Roman", serif'
    case 'sans':  return 'Figtree, "Helvetica Neue", Arial, sans-serif'
    case 'mono':  return '"Courier New", Courier, monospace'
    default:
      // Wrap in quotes if it contains spaces, use as CSS font-family
      return fontFamily.includes(' ') ? `"${fontFamily}", sans-serif` : `${fontFamily}, sans-serif`
  }
}
