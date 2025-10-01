export class ColorFormatter {
  static toString(color: any): string {
    if (!color) {
      return '';
    }
    
    if (typeof color === 'string') {
      return color;
    }
    
    if (Array.isArray(color) && color.length === 3) {
      return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
    
    return '';
  }
}

