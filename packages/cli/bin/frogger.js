#!/usr/bin/env node

// Node.js version check — must use syntax compatible with Node 12+
// (runs before importing compiled code that requires Node 22+)
var nodeVersion = process.versions.node;
var major = parseInt(nodeVersion.split('.')[0], 10);
if (major < 22) {
  console.error(
    'Error: Frogger requires Node.js >= 22.0.0 (current: v' + nodeVersion + ')\n' +
    'Install the latest LTS: https://nodejs.org/'
  );
  process.exit(1);
}

import('../dist/index.js').then(m => m.startCli());
