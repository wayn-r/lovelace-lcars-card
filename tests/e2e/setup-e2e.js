#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HASS_VENV_PATH = '/tmp/hasstest-venv';
const HASS_BIN_PATH = path.join(HASS_VENV_PATH, 'bin', 'hass');

/**
 * Check if the Home Assistant environment exists and is healthy
 */
function isHassEnvironmentHealthy() {
  try {
    // Check if venv directory exists
    if (!fs.existsSync(HASS_VENV_PATH)) {
      return false;
    }

    // Check if hass binary exists
    if (!fs.existsSync(HASS_BIN_PATH)) {
      return false;
    }

    // Check if the binary is executable
    const stats = fs.statSync(HASS_BIN_PATH);
    if (!(stats.mode & parseInt('111', 8))) {
      return false;
    }
    
    // Check for key Python packages in the venv
    const pythonSitePackages = path.join(HASS_VENV_PATH, 'lib', 'python3.12', 'site-packages');
    const homeassistantPackage = path.join(pythonSitePackages, 'homeassistant');
    
    if (!fs.existsSync(homeassistantPackage)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Remove corrupted Home Assistant environment
 */
function removeCorruptedEnvironment() {
  if (fs.existsSync(HASS_VENV_PATH)) {
    try {
      execSync(`rm -rf "${HASS_VENV_PATH}"`, { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ Failed to remove corrupted environment:', error.message);
      process.exit(1);
    }
  }
}

/**
 * Initialize Home Assistant environment using hass-taste-test
 */
function initializeHassEnvironment() {
  console.log('   → Initializing Home Assistant environment (this may take a few minutes)...');
  
  try {
    // Run npx hass-taste-test to set up the environment
    execSync('npx hass-taste-test', { 
      stdio: 'ignore', // Hide all subprocess output (pip, HA setup, etc.)
      cwd: process.cwd()
    });
  } catch (error) {
    console.error('   ❌ Failed to initialize Home Assistant environment:', error.message);
    process.exit(1);
  }
}

/**
 * Main setup function
 */
function setupE2EEnvironment() {
  console.log('🔧 E2E Environment Setup');
  
  // Fast path: check if environment is healthy
  console.log('   → Checking existing environment...');
  if (isHassEnvironmentHealthy()) {
    console.log('   ✅ Environment ready (fast path)');
    return;
  }
  
  // Slow path: repair/recreate environment
  console.log('   → Environment needs initialization (slow path)');
  console.log('   → Cleaning up corrupted files...');
  removeCorruptedEnvironment();
  initializeHassEnvironment();
  
  // Verify the setup worked
  if (isHassEnvironmentHealthy()) {
    console.log('   ✅ Environment ready (initialized)');
  } else {
    console.error('   ❌ Setup failed');
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupE2EEnvironment();
}

export { setupE2EEnvironment };
