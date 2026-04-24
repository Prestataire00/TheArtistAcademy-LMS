#!/usr/bin/env node
// Wrapper de demarrage pour Railway, utilise en fallback si la syntaxe shell
// ${PORT:-3000} du startCommand railway.json ne fonctionne pas (shells minimales,
// /bin/sh != bash selon l'image de base Nixpacks, etc.).
//
// Pour activer ce wrapper : dans apps/web/railway.json, remplacer
//   "startCommand": "HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node .next/standalone/server.js"
// par
//   "startCommand": "node start.js"
//
// Le wrapper :
// - force HOSTNAME=0.0.0.0 (bind sur toutes les interfaces, sinon Next 16
//   bind sur le hostname du container qui n'est pas routable depuis Railway)
// - respecte process.env.PORT injecte par Railway (fallback 3000 en local)
// - charge le server standalone via require (pas de fork, pas de shell)

process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';

console.log(`[start] Next standalone -> hostname=${process.env.HOSTNAME} port=${process.env.PORT}`);

require('./.next/standalone/server.js');
