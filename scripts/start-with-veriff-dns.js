#!/usr/bin/env node
/**
 * Resolve Veriff TURN hostnames via Google DNS, then start Electron with
 * --host-resolver-rules so turn*.falcon-*.veriff.me resolve (fix -105).
 */
const { execSync, spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

let mapRules = '';
try {
  mapRules = execSync('node scripts/resolve-veriff-turn.js', {
    encoding: 'utf8',
    cwd: rootDir,
    timeout: 15000,
  }).trim();
} catch (e) {
  console.warn('Resolve Veriff TURN failed, starting without host-resolver-rules:', e?.message || e);
}

const electronPath = require('electron');
const args = [rootDir];
if (mapRules) {
  args.push('--host-resolver-rules=' + mapRules);
}

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  cwd: rootDir,
});

child.on('close', (code) => process.exit(code != null ? code : 0));
