// Ponto de entrada serverless da Vercel — qualquer chamada pra /api/*
// cai aqui, e o Express (mondayApp.cjs) cuida do roteamento interno.
module.exports = require("./_lib/mondayApp.cjs");
