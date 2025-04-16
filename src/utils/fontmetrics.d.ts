declare module 'fontmetrics' {
  interface FontMetricsOptions {
    fontFamily: string;
    fontWeight?: string | number;
    fontSize?: number;
    origin?: string;
  }
  interface FontMetricsResult {
    capHeight: number;
    baseline: number;
    xHeight: number;
    descent: number;
    bottom: number;
    ascent: number;
    tittle: number;
    top: number;
    fontFamily: string;
    fontWeight: string | number;
    fontSize: number;
  }
  function FontMetrics(options: FontMetricsOptions): FontMetricsResult;
  export = FontMetrics;
} 