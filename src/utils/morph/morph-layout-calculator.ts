
export interface BandContext {
  bandId: string;
  role: 'text' | 'bar-left' | 'bar-right' | 'bar-middle' | 'elbow' | 'endcap' | 'other';
  distanceToTextEdgePx?: number;
}

export type BandContextsMap = Map<string, BandContext>;
