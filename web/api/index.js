// Ponto de entrada serverless da Vercel. O vercel.json redireciona
// /api/* pra cá, e o Express (mondayApp.js) cuida do roteamento interno
// — a URL original chega intacta, então as rotas continuam sendo
// /api/monday/obras, /api/executivo/parse etc.
//
// O package.json ao lado ({"type": "commonjs"}) existe porque o
// web/package.json é "type": "module" — sem ele, o Node trataria estes
// arquivos como ES Module e o require() abaixo quebraria.
module.exports = require("./_lib/mondayApp.js");
