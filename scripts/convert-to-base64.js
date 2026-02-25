#!/usr/bin/env node
/**
 * Converte vídeo/imagem para base64 (útil para substituir em JSON via BurpSuite)
 * Uso: node scripts/convert-to-base64.js caminho/do/video.mp4
 */
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/convert-to-base64.js <arquivo>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(1);
}

const ext = path.extname(filePath).toLowerCase();
const mimeTypes = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

const mime = mimeTypes[ext] || 'application/octet-stream';
const data = fs.readFileSync(filePath);
const base64 = data.toString('base64');
const dataUrl = `data:${mime};base64,${base64}`;

console.log('\n=== Base64 (completo - data URL) ===');
console.log(dataUrl);
console.log('\n=== Base64 (apenas dados) ===');
console.log(base64);
console.log('\n=== Informações ===');
console.log(`Arquivo: ${path.basename(filePath)}`);
console.log(`Tamanho original: ${data.length} bytes (${(data.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Tamanho base64: ${base64.length} caracteres`);
console.log(`MIME type: ${mime}`);
console.log('\n💡 Cole o base64 no BurpSuite (campo JSON) ou use a data URL completa');
