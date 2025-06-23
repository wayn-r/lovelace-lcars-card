declare module 'fontfaceobserver' {
  export default class FontFaceObserver {
    constructor(fontFamily: string, options?: { weight?: string | number; style?: string });
    load(text?: string | null, timeout?: number): Promise<void>;
  }
} 