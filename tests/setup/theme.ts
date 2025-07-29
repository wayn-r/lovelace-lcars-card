import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface ThemeConfig {
  [key: string]: string | Record<string, string>;
}

function resolveCssVariables(themeConfig: ThemeConfig): Record<string, string> {
  const resolvedColors: Record<string, string> = {};
  const variableRegex = /var\((--[a-zA-Z0-9-]+)\)/;

  function resolveValue(key: string, value: string): string {
    if (resolvedColors[key]) {
      return resolvedColors[key];
    }

    const match = value.match(variableRegex);
    if (match) {
      const varName = match[1];
      const referencedKey = varName.replace(/^--/, '');
      
      const referencedValue = themeConfig[referencedKey] as string;

      if (referencedValue) {
        const resolved = resolveValue(referencedKey, referencedValue);
        resolvedColors[key] = resolved;
        return resolved;
      }
    }
    
    resolvedColors[key] = value;
    return value;
  }

  for (const key in themeConfig) {
    if (typeof themeConfig[key] === 'string') {
        resolveValue(key, themeConfig[key] as string);
    } else {
        const subConfig = themeConfig[key] as Record<string, string>;
        for (const subKey in subConfig) {
            resolveValue(subKey, subConfig[subKey]);
        }
    }
  }
  
  return resolvedColors;
}


function injectTheme() {
  try {
    const themePath = path.resolve(__dirname, '../../common/lovelace_theme.yaml');
    const themeFile = fs.readFileSync(themePath, 'utf8');
    const themeConfig = yaml.load(themeFile) as { lcars_theme: ThemeConfig };
    
    if (themeConfig && themeConfig.lcars_theme) {
      const resolvedColors = resolveCssVariables(themeConfig.lcars_theme);

      const cssVariables = Object.entries(resolvedColors)
        .map(([key, value]) => `--${key}: ${value};`)
        .join('\n');
      
      const style = document.createElement('style');
      style.innerHTML = `:root {\n${cssVariables}\n}`;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error('Failed to inject theme for testing:', error);
  }
}

injectTheme(); 