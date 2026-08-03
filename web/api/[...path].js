// Ponto de entrada serverless da Vercel — qualquer chamada pra /api/*
// cai aqui, e o Express (mondayApp.js) cuida do roteamento interno.
//
// O package.json ao lado ({"type": "commonjs"}) existe porque o
// web/package.json é "type": "module" — sem ele, o Node trataria estes
// arquivos como ES Module e o require() abaixo quebraria.
module.exports = require("./_lib/mondayApp.js");
