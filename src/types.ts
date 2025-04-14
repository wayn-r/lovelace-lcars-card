// Extend the Window interface
declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
  
  // Extend HTMLInputElement to include configValue
  interface HTMLInputElement {
    configValue?: string;
  }
}

export {}; 