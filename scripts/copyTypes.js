#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const typeFile = 'index.d.ts';
const typesPath = path.join(process.cwd(), './types', typeFile);
const libPath = path.join(process.cwd(), './lib/', typeFile);
fs.copyFileSync(typesPath, libPath);
