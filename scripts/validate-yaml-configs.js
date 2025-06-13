#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const YAML_EXAMPLES_DIR = join(__dirname, '..', 'yaml-config-examples');

// Simple schema validation for now - we'll just check basic structure
function validateBasicStructure(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }
  
  if (!config.groups || !Array.isArray(config.groups)) {
    throw new Error('Configuration must have a groups array');
  }
  
  for (const group of config.groups) {
    if (!group.group_id || typeof group.group_id !== 'string') {
      throw new Error('Each group must have a group_id string');
    }
    
    if (!group.elements || !Array.isArray(group.elements)) {
      throw new Error('Each group must have an elements array');
    }
    
    for (const element of group.elements) {
      if (!element.id || typeof element.id !== 'string') {
        throw new Error('Each element must have an id string');
      }
      
      if (!element.type || typeof element.type !== 'string') {
        throw new Error('Each element must have a type string');
      }
    }
  }
}

function validateYamlFile(filename) {
  const filePath = join(YAML_EXAMPLES_DIR, filename);
  
  try {
    console.log(`Validating ${filename}...`);
    
    // Read and parse YAML
    const yamlContent = readFileSync(filePath, 'utf8');
    const config = yaml.load(yamlContent);
    
    // Validate basic structure
    validateBasicStructure(config);
    
    console.log(`✓ ${filename} is valid`);
    return true;
  } catch (error) {
    console.error(`✗ ${filename} failed validation:`);
    console.error(error.message);
    return false;
  }
}

function main() {
  console.log('Validating YAML configuration examples...\n');
  
  const yamlFiles = readdirSync(YAML_EXAMPLES_DIR)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .sort();
  
  if (yamlFiles.length === 0) {
    console.log('No YAML files found in yaml-config-examples directory');
    process.exit(0);
  }
  
  let validCount = 0;
  let totalCount = yamlFiles.length;
  
  for (const file of yamlFiles) {
    if (validateYamlFile(file)) {
      validCount++;
    }
    console.log(''); // Empty line between files
  }
  
  console.log(`\nValidation complete: ${validCount}/${totalCount} files passed`);
  
  if (validCount < totalCount) {
    console.error('Some files failed validation');
    process.exit(1);
  } else {
    console.log('All files are valid!');
    process.exit(0);
  }
}

main(); 