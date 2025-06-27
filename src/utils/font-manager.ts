import FontFaceObserver from 'fontfaceobserver';
import FontMetrics from 'fontmetrics';
import { TextMeasurement } from './shapes.js';
import { TextConfig } from '../types.js';

type FontMetricsResult = ReturnType<typeof FontMetrics>;

export class FontManager {
  private static metricsCache = new Map<string, FontMetricsResult | null>();
  private static fontsReadyPromise: Promise<void> | null = null;

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
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
    }
    return this.fontsReadyPromise;
  }

  static getFontMetrics(fontFamily: string, fontWeight: string | number = 'normal', fontSize = 200): FontMetricsResult | null {
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

  static measureTextWidth(text: string, config: TextConfig): number {
    const fontString = `${config.fontWeight || 'normal'} ${config.fontSize || 16}px ${config.fontFamily}`;
    return TextMeasurement.measureSvgTextWidth(text, fontString, config.letterSpacing?.toString(), config.textTransform);
  }

  static clearMetricsCache(): void {
    this.metricsCache.clear();
  }
} 