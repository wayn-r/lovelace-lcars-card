#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const themeFilePath = path.join(projectRoot, 'common', 'lovelace_theme.yaml');
const outputFilePath = path.join(projectRoot, 'src', 'utils', 'embedded-theme.ts');

function embedTheme() {
  try {
    const themeContent = fs.readFileSync(themeFilePath, 'utf8');
    const moduleContent = createModuleContent(themeContent);
    
    fs.writeFileSync(outputFilePath, moduleContent, 'utf8');
    
    console.log('✅ Theme successfully embedded from common/lovelace_theme.yaml');
    console.log(`📝 Generated: ${path.relative(projectRoot, outputFilePath)}`);
    
  } catch (error) {
    console.error('❌ Failed to embed theme:', error.message);
    process.exit(1);
  }
}

function createModuleContent(themeContent) {
  const sanitizedContent = themeContent.replace(/`/g, '\\`');
  
  return `/**
 * Auto-generated file containing embedded theme data
 * DO NOT EDIT MANUALLY - Generated from common/lovelace_theme.yaml
 */

export const EMBEDDED_THEME_YAML = \`${sanitizedContent}\`;
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  embedTheme();
}

export { embedTheme };