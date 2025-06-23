import FontFaceObserver from 'fontfaceobserver';
import FontMetrics from 'fontmetrics';
import { getSvgTextWidth } from './shapes.js';
import { TextConfig } from '../types.js';

/**
 * Centralised font utility so the rest of the codebase no longer talks directly
 * to FontFaceObserver, FontMetrics, or ad-hoc SVG text measurement helpers.
 */
export class FontManager {
  private static metricsCache = new Map<string, ReturnType<typeof FontMetrics> | null>();
  private static fontsReadyPromise: Promise<void> | null = null;

  /** Ensure the supplied font families are fully loaded (or failed) before resolving */
  static async ensureFontsLoaded(fontFamilies: string[] = ['Antonio'], timeout = 5000): Promise<void> {
    if (!this.fontsReadyPromise) {
      const observers = fontFamilies.map((family) => new FontFaceObserver(family).load(null, timeout));
      this.fontsReadyPromise = Promise.allSettled(observers).then(async () => {
        if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
          try {
            await (document as any).fonts.ready;
          } catch {
            /* ignore */
          }
        }
        // Wait a frame so glyph metrics are final.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
    }
    return this.fontsReadyPromise;
  }

  /** Retrieve (and cache) font-metrics for the requested family/weight. */
  static getFontMetrics(fontFamily: string, fontWeight: string | number = 'normal', fontSize = 200): ReturnType<typeof FontMetrics> | null {
    const key = `${fontFamily}::${fontWeight}`;
    if (this.metricsCache.has(key)) return this.metricsCache.get(key)!;

    try {
      const metrics = FontMetrics({ fontFamily, fontWeight, fontSize, origin: 'baseline' });
      this.metricsCache.set(key, metrics);
      return metrics;
    } catch {
      this.metricsCache.set(key, null);
      return null;
    }
  }

  /** Convenience wrapper around the existing SVG text-width helper with cache. */
  static measureTextWidth(text: string, config: TextConfig): number {
    const fontString = `${config.fontWeight || 'normal'} ${config.fontSize || 16}px ${config.fontFamily}`;
    return getSvgTextWidth(text, fontString, config.letterSpacing as any, config.textTransform);
  }

  /** Clear cached FontMetrics so they can be regenerated after font load events. */
  static clearMetricsCache(): void {
    this.metricsCache.clear();
  }
} 