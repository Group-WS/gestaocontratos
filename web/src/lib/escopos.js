/* MODELOS DE ESCOPO — os 24 do Gerador de Escopos WS.
 *
 * Extraidos do "Gerador de Escopos WS.html" e guardados como dado, nao
 * como HTML. Cada modelo traz o texto de escopo que a empresa ja usa em
 * contrato: itens, medicoes com percentual e condicao, garantia,
 * cronograma e observacoes.
 *
 * Cabe no proprio arquivo (74 KB) de proposito: e texto que muda de vez
 * em quando, nao dado de obra. Guardar no banco obrigaria a uma
 * importacao pra abrir um contrato, e a uma consulta pra desenhar a tela.
 *
 * NAO EDITE ESTE ARQUIVO NA MAO. Ele foi gerado do HTML — mexer aqui faz
 * o app e o gerador original discordarem sobre o que a empresa contrata.
 * Mudou o texto no gerador? Extrai de novo.
 *
 * Formato de cada item: { tipo: "item" | "grupo" | "nota", q, u, d, etapa, amb }
 * Formato de cada medicao: { rot, p (percentual), via, cond }
 */
export const MODELOS_ESCOPO = {
 "ar-vrf": {
  "grupo": "Climatização e gás",
  "nome": "Ar-condicionado — VRF / VRV",
  "banda": "Escopo de climatização — sistema VRF / VRV",
  "modo": "medicao",
  "garantia": [
   "Falha no resfriamento, aquecimento ou exaustão;",
   "Vazamentos em drenos, tubulações ou bandejas;",
   "Ruídos, vibrações ou funcionamento irregular;",
   "Baixa eficiência por dimensionamento inadequado;",
   "Mau funcionamento de controles, sensores ou termostatos;",
   "Falhas elétricas decorrentes da instalação;",
   "Acúmulo de condensação por drenagem incorreta;",
   "Fixação inadequada de equipamentos e suportes."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição (entrada)",
    "p": "25",
    "via": "PIX",
    "cond": "Assinatura do contrato, mobilização em obra e execução da infraestrutura básica."
   },
   {
    "rot": "2ª Medição",
    "p": "30",
    "via": "PIX",
    "cond": "Conclusão da mão de obra de instalação dos equipamentos, medida e aprovada pelo CONTRATANTE."
   },
   {
    "rot": "3ª Medição",
    "p": "20",
    "via": "PIX",
    "cond": "Conclusão dos testes e da avaliação de desempenho do sistema, sem pendências."
   },
   {
    "rot": "4ª Medição (retenção de 25%)",
    "p": "25",
    "via": "PIX",
    "cond": "Start-up concluído e aprovação final das entregas, sem pendências."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Execução da infraestrutura básica para instalação do ar-condicionado, incluindo tubulação, dreno e fiação conforme condições técnicas do local. Trata-se da fase inicial do serviço, necessária para a continuidade da instalação do equipamento.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Mão de obra de instalação"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Mão de obra para instalação de ar-condicionado (MARCA) (__).000 BTUs.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Mão de obra para instalação de ar-condicionado (MARCA) (__).000 BTUs.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Testes e comissionamento"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Verificação de vazamentos e avaliação do desempenho do sistema, garantindo o correto funcionamento do ar-condicionado conforme as especificações do fabricante e normas técnicas.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Start-up do sistema VRF/VRV, realizado exclusivamente por profissionais qualificados e/ou autorizados pelo fabricante, incluindo verificação das instalações, parametrização, testes operacionais, validação de desempenho e orientações ao cliente, conforme procedimentos do fabricante.",
    "etapa": 4,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Materiais fornecidos para a infraestrutura"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Tubulações, isolamentos, cabeamentos e demais materiais necessários à execução dos serviços, que deverão atender às normas técnicas e às recomendações do fabricante para instalações VRF/VRV.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "ar-conv": {
  "grupo": "Climatização e gás",
  "nome": "Ar-condicionado — Convencional",
  "banda": "Escopo de climatização — sistema de ar-condicionado convencional",
  "modo": "medicao",
  "garantia": [
   "Falha no resfriamento, aquecimento ou exaustão;",
   "Vazamentos em drenos, tubulações ou bandejas;",
   "Ruídos, vibrações ou funcionamento irregular;",
   "Baixa eficiência por dimensionamento inadequado;",
   "Mau funcionamento de controles, sensores ou termostatos;",
   "Falhas elétricas decorrentes da instalação;",
   "Acúmulo de condensação por drenagem incorreta;",
   "Fixação inadequada de equipamentos e suportes."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição (entrada)",
    "p": "25",
    "via": "PIX",
    "cond": "Montagem da infraestrutura básica e instalação da unidade condensadora."
   },
   {
    "rot": "2ª Medição",
    "p": "50",
    "via": "PIX",
    "cond": "Conclusão da mão de obra de instalação dos equipamentos, medida e aprovada pelo CONTRATANTE."
   },
   {
    "rot": "3ª Medição (retenção de 25%)",
    "p": "25",
    "via": "PIX",
    "cond": "Conclusão dos testes, sem pendências. Retenção liberada após a aprovação final das entregas."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem da infraestrutura básica para instalação do ar-condicionado, incluindo tubulação, dreno e fiação, bem como a instalação da unidade condensadora (parte externa), conforme condições técnicas do local. Trata-se da fase inicial do serviço, necessária para a continuidade da instalação do equipamento.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Mão de obra de instalação"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Mão de obra para instalação de ar-condicionado (MARCA) (__).000 BTUs.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Mão de obra para instalação de ar-condicionado (MARCA) (__).000 BTUs.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Testes e comissionamento"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Verificação de vazamentos e avaliação do desempenho do sistema, garantindo o correto funcionamento do ar-condicionado conforme as especificações do fabricante e normas técnicas.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Materiais fornecidos para a infraestrutura"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "m",
    "d": "Tubulações, isolamentos, cabeamentos e demais materiais necessários à execução dos serviços, que deverão atender às normas técnicas e às recomendações do fabricante.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "gas": {
  "grupo": "Climatização e gás",
  "nome": "Sistema de gás / Aquecedor",
  "banda": "Escopo para sistema de gás ou instalação de aquecedor",
  "modo": "medicao",
  "garantia": [
   "Vazamentos em tubulações, conexões ou registros;",
   "Falhas na vedação de juntas e emendas;",
   "Instalação inadequada de válvulas ou registros de segurança;",
   "Pressão irregular no fornecimento de gás;",
   "Desalinhamento ou mau posicionamento dos pontos de saída;",
   "Risco de retorno de gás por instalação incorreta;",
   "Danos causados por fixação ou soldagem inadequadas."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Infraestrutura"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Execução de infraestrutura para criação de ponto de gás. (Descrever os serviços previstos para a infraestrutura do gás.)",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Instalação de aquecedor"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "(Descrever os serviços de instalação do aquecedor.)",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Materiais inclusos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Todos os materiais básicos e necessários para a execução dos serviços descritos neste escopo estão inclusos, salvo itens especiais ou não previstos.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "iluminacao": {
  "grupo": "Elétrica e automação",
  "nome": "Elétrica e iluminação",
  "banda": "Escopo de serviços — elétrica e iluminação",
  "modo": "medicao",
  "garantia": [
   "Falhas elétricas decorrentes de conexões mal executadas;",
   "Mau contato elétrico em tomadas, interruptores, luminárias e pontos de energia;",
   "Desligamentos, instabilidades ou funcionamento irregular dos circuitos;",
   "Sobrecarga elétrica causada por dimensionamento ou instalação incorreta;",
   "Cabos rompidos, prensados ou danificados por instalação inadequada;",
   "Pontos de energia sem funcionamento após período de uso;",
   "Interferências, ruídos ou oscilações causadas por ligações incorretas;",
   "Luminárias, spots e perfis de LED com falhas de acionamento ou iluminação irregular;",
   "Drivers, reatores ou fontes com defeito por instalação inadequada;",
   "Defeitos resultantes de fixação inadequada de dispositivos elétricos;",
   "Quadros, disjuntores ou proteções mal ajustados ou mal instalados;",
   "Falhas na organização, identificação e acabamento das instalações."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Adequação e infraestrutura elétrica: alteração, remanejamento e criação de pontos elétricos; criação de pontos para eletrodomésticos e equipamentos em geral conforme projeto; criação de pontos de iluminação LED decorativa, conforme projeto, em marcenaria, cortineiros, pedras, estruturas metálicas, nichos e/ou perfis; adequação e/ou criação de circuitos conforme projeto; isolamento de pontos não utilizados; organização preliminar do quadro de distribuição.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Instalação de iluminação: instalação de spots, plafons, luminárias e/ou perfis; instalação de fitas LED decorativas, conforme projeto, em marcenaria, cortineiros, pedras, estruturas metálicas, nichos e/ou perfis; instalação de pontos de tomada em marcenaria; testes parciais de funcionamento.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 3 — Finalização e acabamentos: instalação de pendentes, arandelas, abajures e luminárias decorativas; instalação de interruptores, tomadas e acabamentos; ajustes de altura, alinhamento e direcionamento de focos; organização e identificação definitiva do quadro elétrico; reinstalação de acabamentos onde necessário.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Os quantitativos e os serviços inclusos neste escopo estão descritos conforme o projeto luminotécnico e elétrico aprovado."
   }
  ]
 },
 "ilum-automacao": {
  "grupo": "Elétrica e automação",
  "nome": "Iluminação / Automação / Sonorização",
  "banda": "Escopo de serviços — iluminação, automação e sonorização",
  "modo": "medicao",
  "garantia": [
   "Perda de sinal, baixa performance ou instabilidade por erro de instalação;",
   "Cabos mal crimpados, pares invertidos, conectores frouxos ou mau contato;",
   "Pontos inoperantes, intermitentes ou identificados incorretamente;",
   "Falhas em patch panels, keystones, tomadas e espelhos por montagem inadequada;",
   "Problemas causados por roteamento incorreto (proximidade com elétrica, dobras excessivas);",
   "Danos por má instalação (cabos rompidos, prensados ou curvatura fora do padrão);",
   "Organização inadequada em racks e calhas, com risco de desconexão;",
   "Mau contato ou falhas em tomadas, interruptores e pontos de energia;",
   "Instabilidade, desligamentos ou funcionamento irregular de circuitos;",
   "Sobrecarga elétrica por erro de dimensionamento ou instalação;",
   "Cabos danificados por execução inadequada;",
   "Luminárias, spots, perfis de LED e equipamentos com falhas por instalação incorreta;",
   "Drivers, fontes ou reatores danificados por erro de montagem;",
   "Quadros, disjuntores e proteções mal instalados ou desajustados;",
   "Falhas de organização, identificação e acabamento da instalação elétrica."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% sobre o valor total de cada item do contrato, referente à entrada e à conclusão da Etapa 01. O valor liberado deve corresponder aos serviços iniciais, e não ao valor total do contrato."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "43",
    "via": "PIX",
    "cond": "Corresponde a até 43% sobre o valor total de cada item do contrato. Poderá ser liberada por meio de medições, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "32",
    "via": "PIX",
    "cond": "Corresponde a até 32% sobre o valor total de cada item do contrato, a ser pago somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Elétrica e iluminação"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Adequação e infraestrutura elétrica: alteração, remanejamento e criação de pontos elétricos; criação de pontos para eletrodomésticos e equipamentos em geral conforme projeto; criação de pontos de iluminação LED decorativa em marcenaria, cortineiros, pedras, estruturas metálicas, nichos e/ou perfis; adequação e/ou criação de circuitos; isolamento de pontos não utilizados; organização preliminar do quadro de distribuição.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Instalação de iluminação: instalação de spots, plafons, luminárias e/ou perfis; instalação de fitas LED decorativas conforme projeto; instalação de pontos de tomada em marcenaria; testes parciais de funcionamento.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 3 — Finalização e acabamentos: instalação de pendentes, arandelas, abajures e luminárias decorativas; instalação de interruptores, tomadas e acabamentos; ajustes de altura, alinhamento e direcionamento de focos; organização e identificação definitiva do quadro elétrico.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Os quantitativos e os serviços inclusos neste escopo estão descritos conforme o projeto luminotécnico e elétrico aprovado."
   },
   {
    "tipo": "grupo",
    "d": "Automação"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Passagem de infraestrutura: passagem dos cabos de retorno (persianas, cortinas, flaps de TV, entre outros); passagem de cabos de rede e cabeamento para interruptores e dispositivos de automação; instalação de receptores infravermelhos em equipamentos de ar-condicionado; organização e identificação preliminar dos cabos.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Montagem e integração dos sistemas: instalação de antenas UniFi (quando previsto em projeto); instalação do quadro de automação/elétrico; instalação de relés, relés slim, fontes, nobreak, switches, Mikrotik e demais componentes; montagem conforme esquema técnico do projeto; interligação entre os módulos e sistemas; organização interna e etiquetagem dos componentes.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 3 — Configuração e finalização: instalação de keypads, pulsadores, sensores e interfaces; configuração dos módulos e controladores; testes funcionais dos circuitos e retornos; validação das identificações do quadro conforme projeto; ajustes finais.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Nota de conferência técnica: ao término de cada etapa de infraestrutura, o responsável pela configuração final da automação deverá realizar a conferência dos serviços executados, validando a infraestrutura e a conformidade com o projeto."
   },
   {
    "tipo": "grupo",
    "d": "Sonorização"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Passagem de infraestrutura: passagem de cabeamento conforme projeto; organização e identificação de cabos.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Configuração e finalização: instalação dos equipamentos e amplificadores em geral; integração com a automação, se houver; configuração do sistema; testes de funcionamento geral. (Vinculada à última medição.)",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Os itens inclusos neste escopo, bem como os circuitos e os itens a serem instalados e automatizados, estão descritos conforme a planta de automação e o orçamento aprovados."
   }
  ]
 },
 "eletros": {
  "grupo": "Elétrica e automação",
  "nome": "Eletroeletrônicos",
  "banda": "Escopo de eletroeletrônicos",
  "modo": "medicao",
  "garantia": [
   "Falha de funcionamento, não acionamento ou operação intermitente;",
   "Curto-circuito, mau contato em cabos/terminais ou conectores soltos;",
   "Queima prematura de fontes, drivers ou componentes por instalação inadequada;",
   "Problemas de fixação/montagem (folgas, desalinhamento, travas);",
   "Defeitos em painéis de comando, displays, sensores ou controles."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "1ª Etapa — Infraestrutura"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Execução de infraestrutura para sistemas de exaustão de coifas (dutos, passagens e conexões).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Para os demais equipamentos, o contratado deverá orientar e realizar a conferência das infraestruturas executadas por terceiros, a fim de garantir o perfeito funcionamento dos eletrodomésticos a serem instalados posteriormente."
   },
   {
    "tipo": "grupo",
    "d": "Instalação — itens Elettromec (linha premium) ou linha branca (médio padrão): escolher uma opção"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Cozinha / Living: geladeira; frigobar; freezer; cooktop; forno (elétrico ou a gás); micro-ondas; coifa (ilha ou parede); depurador; lava-louças; adega climatizada; purificador de água; cervejeira; churrasqueira (elétrica ou a gás); máquina de gelo; chopeira.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Área de serviço: máquina de lavar roupas; secadora de roupas; lava e seca.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Sistema flap: estrutura e fixação (preparação do local e fixação da estrutura na laje); instalação do motor e conexão elétrica; ajustes e configurações (nivelamento, alinhamento com o forro e configuração dos limites de abertura, inclinação e rotação). Ao final do serviço, o sistema deverá operar de forma silenciosa, alinhado ao forro, com movimentos estáveis e seguros.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Televisores: fixação em parede, painel ou sistema flap, bem como a realização das conexões necessárias, incluindo ligação à rede elétrica, conexão de cabos, organização básica da fiação e testes de funcionamento.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Os quantitativos de cada item incluídos neste escopo seguirão o descritivo dos itens orçados, conforme orçamento formalizado entre as partes, devendo todos os itens instalados ser devidamente testados e validados quanto ao seu funcionamento."
   },
   {
    "tipo": "grupo",
    "d": "Materiais inclusos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Todos os materiais básicos e necessários para a execução dos serviços descritos neste escopo estão inclusos, salvo itens especiais ou não previstos.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "civil": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Construção civil",
  "banda": "Escopo para serviços de construção civil",
  "modo": "medicao",
  "garantia": [
   "Trincas, fissuras ou rachaduras em paredes, alvenarias, rebocos, lajes e estruturas;",
   "Desplacamento, soltura ou falhas em reboco, massa corrida, argamassas e regularizações;",
   "Desnivelamento de pisos, caimentos incorretos e deformações em contrapiso;",
   "Falhas de prumo, esquadro e alinhamento em paredes, vãos e elementos executados;",
   "Infiltrações decorrentes de falhas na aplicação de sistemas de impermeabilização;",
   "Falhas em ralos, rodapés, encontros e passagens por vedação inadequada;",
   "Umidade ascendente, manchas e mofo por falhas na impermeabilização;",
   "Desagregação, trincamento ou perda de resistência por execução inadequada;",
   "Infiltrações em áreas molhadas por falhas construtivas;",
   "Defeitos nos arremates e acabamentos relacionados à execução."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "gesso": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Gesso e drywall",
  "banda": "Escopo para instalação de gesso e drywall",
  "modo": "medicao",
  "garantia": [
   "Trincas, fissuras ou rachaduras nas superfícies;",
   "Desnivelamento ou ondulações em tetos e paredes;",
   "Descolamento, empenamento ou queda de placas ou estruturas;",
   "Risco de desprendimento com possibilidade de causar acidentes;",
   "Queda parcial ou total de forros, painéis ou revestimentos;",
   "Fragilidade estrutural por uso de material de baixa resistência;",
   "Falhas no acabamento, emendas aparentes ou imperfeições;",
   "Infiltrações decorrentes de vedação inadequada;",
   "Fixação incorreta de perfis, estruturas ou suportes;",
   "Manchas, bolhas ou descascamento da pintura por base mal preparada."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "hidraulica": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Instalações hidrossanitárias",
  "banda": "Escopo para serviços de instalações hidrossanitárias",
  "modo": "medicao",
  "garantia": [
   "Vazamentos em tubulações, conexões, registros e pontos hidráulicos;",
   "Falhas de vedação em sifões, válvulas, ralos e caixas sifonadas;",
   "Entupimentos recorrentes por montagem inadequada ou inclinação incorreta;",
   "Retorno de odores por instalação inadequada de sifonagem ou ventilação;",
   "Baixa vazão, pressão irregular ou ruídos anormais por dimensionamento ou montagem;",
   "Fixação inadequada de tubulações, suportes e peças embutidas;",
   "Infiltrações em passagens e shafts por execução ou vedação inadequada."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "revestimento": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Revestimento cerâmico",
  "banda": "Escopo para serviços de instalação de revestimento cerâmico",
  "modo": "medicao",
  "garantia": [
   "Descolamento, soltura ou destacamento de peças;",
   "Trincas, quebras ou fissuras em pisos e paredes;",
   "Desnivelamento, peças ocas ou som cavo;",
   "Abertura de juntas, falhas de rejunte ou infiltrações;",
   "Manchas, eflorescência ou variação de tonalidade;",
   "Paginação desalinhada ou recortes irregulares."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "carpete": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Carpetes",
  "banda": "Escopo para instalação de carpetes",
  "modo": "medicao",
  "garantia": [
   "Descolamento, soltura ou falhas de aderência/colagem;",
   "Ondulações, enrugamentos ou formação de bolhas;",
   "Abertura de emendas, desfiamento ou bordas levantadas;",
   "Desalinhamento de paginação/desenho e recortes irregulares;",
   "Manchas ou alteração de cor por aplicação inadequada de cola ou acabamento."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "piso-vinilico": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Piso vinílico",
  "banda": "Escopo para instalação de piso vinílico",
  "modo": "medicao",
  "garantia": [
   "Descolamento, soltura de réguas/mantas ou falha de aderência;",
   "Bolhas, ondulações, levantamento de bordas ou empenamento;",
   "Abertura de juntas, desalinhamento e variação de paginação;",
   "Estalos, rangidos ou movimentação por base irregular ou cola inadequada;",
   "Marcas de emenda aparentes e falhas de acabamento em arremates;",
   "Afundamentos por falta de regularização ou nível do contrapiso."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "pintura-concluido": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Pintura — padrão concluído",
  "banda": "Escopo de serviços de pintura — unidade com pintura padrão concluída",
  "modo": "medicao",
  "garantia": [
   "Descascamento, soltura ou perda de aderência da tinta;",
   "Bolhas, empolamentos ou craquelamento por preparação inadequada da base;",
   "Manchas, diferenças de tonalidade, transparências ou cobertura irregular;",
   "Marcas de emenda, rolo ou pincel, respingos e falhas de acabamento;",
   "Fissuras aparentes por falta de tratamento ou preenchimento adequado;",
   "Mofo ou manchas superficiais decorrentes de base mal selada ou preparo inadequado;",
   "Esfarelamento, pó ou falta de resistência por aplicação fora do padrão."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "obs": "Proteção de pisos, rodapés, portas, janelas, luminárias, móveis e marcenaria.\nUtilização de lona, papelão, plástico ou material equivalente.\nVerificação e tratamento prévio de manchas, mofo ou umidade superficial, quando identificado.\nA correção de danos causados por terceiros, antes da entrega final, será negociada previamente.",
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Fase inicial da obra: lixamento e preparação das superfícies (caso necessário, lixar áreas com imperfeições e remover poeira e sujeiras que possam comprometer a aderência da tinta); verificação do estado das paredes, tetos e demais elementos a serem pintados; correção de imperfeições (trincas, buracos ou rachaduras preenchidos com massa corrida ou outro material adequado); aplicação da primeira demão. Aplicação de tintas conforme padrão definido pelo CONTRATANTE.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Fase final da obra. Tetos: proteção do ambiente; emassamento e correção de imperfeições; lixamento do teto; pintura geral. Paredes: preparação e correção das superfícies; lixamento fino; nova pintura completa das paredes.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 3 — Retoques finos para uniformização do acabamento; correção de eventuais falhas, manchas, marcas de rolo, respingos ou diferenças de tonalidade; vistoria técnica geral de todas as superfícies pintadas (paredes e tetos).",
    "etapa": 3,
    "amb": ""
   }
  ]
 },
 "pintura-bruto": {
  "grupo": "Obra civil e acabamentos",
  "nome": "Pintura — estado bruto",
  "banda": "Escopo de serviços de pintura — unidade em estado bruto (sem acabamento fino)",
  "modo": "medicao",
  "garantia": [
   "Descascamento, soltura ou perda de aderência da tinta;",
   "Bolhas, empolamentos ou craquelamento por preparação inadequada da base;",
   "Manchas, diferenças de tonalidade, transparências ou cobertura irregular;",
   "Marcas de emenda, rolo ou pincel, respingos e falhas de acabamento;",
   "Fissuras aparentes por falta de tratamento ou preenchimento adequado;",
   "Mofo ou manchas superficiais decorrentes de base mal selada ou preparo inadequado;",
   "Esfarelamento, pó ou falta de resistência por aplicação fora do padrão."
  ],
  "obs": "Proteção de pisos, rodapés, portas, janelas, luminárias, móveis e marcenaria.\nUtilização de lona, papelão, plástico ou material equivalente.\nVerificação e tratamento prévio de manchas, mofo ou umidade superficial, quando identificado.\nA correção de danos causados por terceiros, antes da entrega final, será negociada previamente.",
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e ao início da execução da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "15",
    "via": "PIX",
    "cond": "Corresponde a até 15% do valor total do contrato, após a conclusão das Etapas 01 e 02, mediante a conclusão e aprovação dos serviços."
   },
   {
    "rot": "3ª Medição — Etapa 03",
    "p": "35",
    "via": "PIX",
    "cond": "Corresponde a 35% do valor total do contrato. Poderá ser liberada por meio de medições parciais, porém o valor total somente será liberado após a conclusão e aprovação dos serviços da Etapa 03."
   },
   {
    "rot": "4ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 1 — Fase inicial da obra: emassamento completo das superfícies; lixamento geral; preparação das paredes e tetos; aplicação de fundo/selador, quando necessário. Aplicação de tintas conforme padrão definido pelo CONTRATANTE.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 2 — Aplicação da primeira demão. Aplicação de tintas conforme padrão definido pelo CONTRATANTE.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 3 — Fase final da obra. Tetos: proteção do ambiente; emassamento e correção de imperfeições; lixamento do teto; pintura geral. Paredes: preparação e correção das superfícies; lixamento fino; nova pintura completa das paredes.",
    "etapa": 3,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Etapa 4 — Retoques finos para uniformização do acabamento; correção de eventuais falhas, manchas, marcas de rolo, respingos ou diferenças de tonalidade; vistoria técnica geral de todas as superfícies pintadas (paredes e tetos).",
    "etapa": 4,
    "amb": ""
   }
  ]
 },
 "metais": {
  "grupo": "Louças, metais e decoração",
  "nome": "Louças e metais",
  "banda": "Escopo — louças e metais",
  "modo": "medicao",
  "garantia": [
   "Vazamentos em torneiras, registros, válvulas e conexões decorrentes de instalação inadequada;",
   "Mau funcionamento de misturadores, monocomandos e válvulas por montagem incorreta;",
   "Fixação inadequada de cubas, vasos sanitários, pias e acessórios;",
   "Falhas de vedação em sifões, ralos e pontos de esgoto por execução incorreta;",
   "Folgas, instabilidade ou desalinhamento das peças instaladas;",
   "Trincas, quebras ou lascas causadas por instalação inadequada;",
   "Entupimentos decorrentes de montagem incorreta ou inclinação inadequada;",
   "Ruídos ou retorno de odores por falhas na instalação hidráulica;",
   "Problemas decorrentes de uso inadequado de materiais de vedação;",
   "Defeitos resultantes de montagem fora das especificações técnicas;",
   "Falhas nos arremates e acabamentos relacionados à execução;",
   "Refixação e ajustes necessários decorrentes de erro de instalação."
  ],
  "medicoes": [
   {
    "rot": "1ª Medição — Itens livres para instalação",
    "p": "60",
    "via": "PIX",
    "cond": "Itens cuja finalização não é condicionada a outras etapas da obra: serão liberados para pagamento após a conclusão e aprovação dos serviços executados, podendo ser liberados por meio de medições parciais, até o limite máximo de 60% do valor total do contrato."
   },
   {
    "rot": "2ª Medição — Itens condicionados / Finalização",
    "p": "40",
    "via": "PIX",
    "cond": "Itens condicionados à finalização de outros serviços: o pagamento será liberado após a conclusão integral de todas as instalações, sem pendências, bem como após a conferência final prevista neste escopo."
   }
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Instalação de louças — 1ª etapa"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de vasos sanitários (com caixa acoplada).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de cubas.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Instalação de metais e acessórios — 1ª etapa"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de acabamentos de registros e misturadores.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de acabamentos monocomando para chuveiro e ducha.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de chuveiros.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de duchas higiênicas.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de porta-toalhas bastão e de rosto.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de cabides.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de papeleiras.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de prateleiras.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de assentos para vaso sanitário.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de toalheiros térmicos (quando houver).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de suportes diversos (quando houver).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Instalação de metais — 2ª etapa"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Instalação de torneiras, misturadores e monocomandos.",
    "etapa": 2,
    "amb": ""
   },
   {
    "tipo": "nota",
    "d": "Está inclusa neste escopo a instalação de sifões, engates flexíveis e válvulas de escoamento, bem como a realização de testes de funcionamento de todos os equipamentos e a verificação de vazamentos."
   },
   {
    "tipo": "grupo",
    "d": "Materiais inclusos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Silicone, veda-rosca, parafusos e buchas padrão.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "cortinas": {
  "grupo": "Louças, metais e decoração",
  "nome": "Cortinas e persianas",
  "banda": "Escopo de cortinas e persianas",
  "modo": "parcelado",
  "garantia": [
   "Travamentos, funcionamento irregular ou dificuldade de abertura/fechamento;",
   "Desalinhamento, queda de trilhos, suportes ou varões por fixação inadequada;",
   "Falhas em mecanismos (cordões, correntes, recolhimento) em uso normal;",
   "Problemas em motorização (não aciona, intermitência, ruído anormal);",
   "Enrolamento ou deslizamento irregular e deformações;",
   "Descolamento de acabamentos, ponteiras e terminais."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "crono": [
   [
    "Prazo de medição / produção",
    "A medição in loco será realizada mediante solicitação formal do contratante, e a produção será iniciada após a confirmação das medidas in loco."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Instalação completa das peças;\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "estofados": {
  "grupo": "Marcenaria e mobiliário",
  "nome": "Estofados sob medida",
  "banda": "Escopo de estofados sob medida",
  "modo": "parcelado",
  "garantia": [
   "Afundamento, deformação ou perda de sustentação de espumas em uso normal;",
   "Folgas, desalinhamento ou deformação de estrutura interna;",
   "Rangidos ou ruídos por fixações internas inadequadas;",
   "Descolamento de revestimentos (tecido, couro ou sintético) e acabamentos."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "crono": [
   [
    "Prazo de medição / produção",
    "A medição in loco será realizada mediante solicitação formal do contratante, e a produção será iniciada após a confirmação das medidas in loco."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Instalação completa das peças;\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "marcenaria-dalmobile": {
  "grupo": "Marcenaria e mobiliário",
  "nome": "Montagem de marcenaria — Dalmóbile",
  "banda": "Escopo de serviços de montagem de marcenaria",
  "modo": "medicao",
  "garantia": [
   "Desalinhamento, falta de prumo ou esquadro na montagem dos móveis;",
   "Dificuldade de abertura e fechamento de portas, gavetas e basculantes por ajuste inadequado;",
   "Folgas, empenamentos ou instabilidade estrutural decorrentes da montagem;",
   "Fixação inadequada de módulos, painéis, prateleiras e armários;",
   "Desnivelamento entre peças, módulos e frentes;",
   "Falhas na instalação de dobradiças, corrediças, pistões e demais ferragens;",
   "Ruídos, rangidos ou travamentos causados por montagem incorreta;",
   "Descolamento de fitas de borda, fundos e acabamentos por erro de instalação;",
   "Abertura de frestas e emendas por ajuste inadequado;",
   "Fixação incorreta em paredes, tetos ou estruturas de apoio;",
   "Defeitos nos arremates, recortes e acabamentos decorrentes da execução;",
   "Refixação, reaperto e regulagens decorrentes de erro de montagem."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "colAmbiente": true,
  "colValor": true,
  "usaCustoMaterial": true,
  "crono": [
   [
    "Cronograma de instalação",
    "O cronograma de instalação deverá ser realizado de acordo com as prioridades da obra, que serão previamente repassadas, dentro do prazo estipulado."
   ]
  ],
  "caixa": {
   "titulo": "Estão incluídos neste escopo",
   "paras": [
    "Fica estabelecido que o presente contrato inclui a montagem completa de todos os móveis fornecidos pela Dalmóbile, conforme detalhado no projeto e no caderno técnico de montagem.",
    "1. A instalação de toda a iluminação fornecida pela Dalmóbile, tais como fitas de LED, cabides iluminados e outros acessórios elétricos, desde que previstos em projeto e entregues juntamente com os móveis;",
    "2. A execução de todos os cortes, ajustes, rasgos e acabamentos indicados no caderno de montagem, bem como pequenos ajustes de largura e altura, garantindo a adequada finalização e qualidade da montagem, sem cobrança adicional, desde que não caracterizem retrabalho decorrente de erro de projeto ou fabricação;",
    "3. A montagem de peças oriundas de assistências técnicas, quando indispensáveis à finalização da montagem;",
    "4. A realização de ajustes finais ou correções pontuais identificadas durante a montagem, desde que não decorrentes de mau uso, interferência de terceiros ou alterações de projeto não previamente acordadas;",
    "5. O fornecimento de ferramentas necessárias para execução dos serviços.",
    "Parágrafo único: todos os itens acima estão contemplados no valor total contratado para a montagem, não sendo devidos valores adicionais ao montador, salvo em caso de solicitação de serviços fora do escopo aqui descrito ou decorrentes de alterações posteriores ao projeto original."
   ]
  },
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Área de serviço"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "BWC suíte 01"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "BWC suíte 02"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "BWC suíte master"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "BWC dependência"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Cozinha"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Dependência"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Lavabo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Living"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Hall"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Circulação"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Suíte 01"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Suíte 02"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Montagem completa dos móveis do ambiente.",
    "etapa": 1,
    "amb": "Suíte master"
   }
  ]
 },
 "marcenaria-terceirizada": {
  "grupo": "Marcenaria e mobiliário",
  "nome": "Marcenaria terceirizada",
  "banda": "Escopo de serviços de marcenaria",
  "modo": "parcelado",
  "garantia": [
   "Desalinhamento, falta de prumo ou esquadro na montagem dos móveis;",
   "Dificuldade de abertura e fechamento de portas, gavetas e basculantes por ajuste inadequado;",
   "Folgas, empenamentos ou instabilidade estrutural decorrentes da montagem;",
   "Fixação inadequada de módulos, painéis, prateleiras e armários;",
   "Desnivelamento entre peças, módulos e frentes;",
   "Falhas na instalação de dobradiças, corrediças, pistões e demais ferragens;",
   "Ruídos, rangidos ou travamentos causados por montagem incorreta;",
   "Descolamento de fitas de borda, fundos e acabamentos por erro de instalação;",
   "Abertura de frestas e emendas por ajuste inadequado;",
   "Fixação incorreta em paredes, tetos ou estruturas de apoio;",
   "Defeitos nos arremates, recortes e acabamentos decorrentes da execução;",
   "Refixação, reaperto e regulagens decorrentes de erro de montagem."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "colAmbiente": true,
  "colValor": true,
  "quadro": {
   "titulo": "Cronograma geral de entregas",
   "prazoGeral": "",
   "obs": "A produção somente será liberada após a aprovação do cliente e da TKWS.",
   "linhas": [
    {
     "n": "1",
     "dur": "",
     "desc": "Medição"
    },
    {
     "n": "2",
     "dur": "",
     "desc": "Caderno de apresentação"
    },
    {
     "banda": "Revisão / aprovação do cliente — responsável WS"
    },
    {
     "n": "3",
     "dur": "",
     "desc": "Caderno de montagem"
    },
    {
     "n": "4",
     "dur": "",
     "desc": "Produção da marcenaria"
    },
    {
     "n": "5",
     "dur": "",
     "desc": "Transporte"
    },
    {
     "n": "6",
     "dur": "",
     "desc": "Montagem"
    }
   ]
  },
  "caixa": {
   "titulo": "Responsabilidades da contratada",
   "paras": [
    "Padrões TKWS a serem adotados: solicite apoio do setor de marcenaria para elaborar a descrição.",
    "Medições: realizar todas as medições necessárias nos ambientes, incluindo pontos hidráulicos, elétricos, estruturais, estéticos e quaisquer outros elementos que possam impactar na execução dos serviços de marcenaria.",
    "Logística: providenciar, organizar e executar toda a logística de transporte, incluindo frete e entrega dos materiais e componentes diretamente no local da obra, de forma a garantir o cumprimento do cronograma previamente estabelecido.",
    "Assistências: prestar todas as assistências técnicas e realizar os ajustes que se façam necessários para a plena conclusão e perfeita execução dos serviços de marcenaria, garantindo a conformidade com o projeto em anexo."
   ]
  },
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "(Descrever tudo que será incluso no ambiente.)",
    "etapa": 1,
    "amb": "(Ambiente)"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "(Descrever tudo que será incluso no ambiente.)",
    "etapa": 1,
    "amb": "(Ambiente)"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "(Descrever tudo que será incluso no ambiente.)",
    "etapa": 1,
    "amb": "(Ambiente)"
   }
  ]
 },
 "esquadrias": {
  "grupo": "Esquadrias, vidros e pedras",
  "nome": "Esquadrias",
  "banda": "Escopo de instalação de esquadrias",
  "modo": "parcelado",
  "garantia": [
   "Dificuldade de abertura/fechamento, travamentos ou funcionamento irregular;",
   "Desalinhamento de folhas, empenamento ou falta de prumo/esquadro;",
   "Falhas em roldanas, trilhos, dobradiças, fechos e ferragens;",
   "Vedação inadequada (entrada de água, vento ou poeira) em uso normal;",
   "Infiltrações em encontros por vedação ou selagem inadequada;",
   "Vibrações, ruídos ou folgas excessivas;",
   "Falhas de fixação, chumbamento ou ancoragem da esquadria."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "crono": [
   [
    "Prazo de medição",
    "A medição in loco será realizada mediante solicitação formal do contratante."
   ],
   [
    "Prazo de produção",
    "O prazo de produção será contado após a aprovação das medidas e dos materiais in loco."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Transporte até o local da instalação;\n• Instalação completa das peças;\n• Acabamentos e ajustes necessários para entrega final.\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Especificação dos materiais fornecidos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "(Descrever os materiais fornecidos: perfis, vidros, ferragens, acabamentos e cores.)",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "vidros": {
  "grupo": "Esquadrias, vidros e pedras",
  "nome": "Vidros e espelhos",
  "banda": "Escopo — vidros e espelhos",
  "modo": "parcelado",
  "garantia": [
   "Descolamento, soltura ou falhas de fixação/colagem;",
   "Trincas, quebras ou lascas decorrentes de instalação inadequada;",
   "Vibração, folgas ou ruídos por ferragens/suportes mal ajustados;",
   "Manchas, descoloração ou oxidação do espelho por vedação inadequada;",
   "Falhas em silicone ou selantes (abertura, fissuras) gerando infiltração;",
   "Desalinhamento, nivelamento incorreto e arremates irregulares;",
   "Problemas em ferragens (dobradiças, puxadores, suportes) por montagem inadequada;",
   "Vazamentos, travamentos ou deslizamento irregular em box."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "colAmbiente": true,
  "crono": [
   [
    "Prazo de medição / produção",
    "A medição in loco será realizada mediante solicitação formal do contratante, e a produção será iniciada após a confirmação das medidas, com prazo estimado de (___) dias."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Box"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Box piso-teto em perfil cromado; vidro incolor temperado 8 mm e puxador usinado.",
    "etapa": 1,
    "amb": "Suíte master"
   },
   {
    "tipo": "nota",
    "d": "Informar se o box é do tipo piso-teto ou até certa altura, bem como a cor do perfil, o tipo de vidro e o tipo de puxador."
   },
   {
    "tipo": "grupo",
    "d": "Vidros"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "m²",
    "d": "Informar o tipo de vidro, bem como o sistema de fixação e a cor (quando houver).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Espelhos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "m²",
    "d": "Informar o tipo de espelho, o formato, o tipo de lapidação das bordas e se o fornecimento contempla apenas o jateamento ou o espelho já preparado com iluminação (quando houver).",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Instalação completa das peças;\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "marmoraria": {
  "grupo": "Esquadrias, vidros e pedras",
  "nome": "Marmoraria",
  "banda": "Escopo de marmoraria",
  "modo": "parcelado",
  "garantia": [
   "Trincas, fissuras, quebras ou lascas decorrentes de instalação inadequada;",
   "Descolamento, soltura ou falhas de fixação de bancadas, painéis e revestimentos;",
   "Desnivelamento, falta de prumo ou esquadro em peças instaladas;",
   "Abertura de juntas, falhas de vedação e arremates irregulares;",
   "Manchas, perda de brilho ou alteração de cor por impermeabilização inadequada;",
   "Infiltrações em áreas de cubas, frontões e rodabancas por vedação incorreta;",
   "Empoçamento de água em bancadas e superfícies por caimento incorreto;",
   "Desalinhamento de emendas e paginação irregular das peças;",
   "Quebras em recortes de cubas, cooktops e acessórios por execução incorreta;",
   "Fixação inadequada de peças verticais com risco de desprendimento;",
   "Rachaduras em áreas de apoio por base mal nivelada;",
   "Defeitos de acabamento em polimento, bordas e quinas."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "crono": [
   [
    "Prazo de medição",
    "A medição in loco será realizada mediante solicitação formal do contratante."
   ],
   [
    "Prazo de produção",
    "O prazo de produção será contado após a aprovação das medidas e dos materiais in loco."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "itens": [
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Transporte até o local da instalação;\n• Instalação completa das peças;\n• Acabamentos e ajustes necessários para entrega final.\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   },
   {
    "tipo": "grupo",
    "d": "Materiais fornecidos"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "Descreva os materiais que serão utilizados no projeto.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "estrutura-metalica": {
  "grupo": "Esquadrias, vidros e pedras",
  "nome": "Estrutura metálica",
  "banda": "Escopo de fornecimento e instalação — estrutura metálica",
  "modo": "parcelado",
  "garantia": [
   "Oxidação precoce, ferrugem ou corrosão;",
   "Desalinhamento, empenamento ou deformação estrutural;",
   "Soltura ou falhas de fixação de painéis e suportes;",
   "Trincas em soldas ou pontos de união;",
   "Vibração, ruídos ou instabilidade;",
   "Manchas, desbotamento ou desgaste do revestimento;",
   "Infiltrações em juntas e encontros;",
   "Acabamento irregular."
  ],
  "medicoes": [
   {
    "rot": "Entrada",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde à entrada do contrato, referente à mobilização em obra e ao início da execução dos serviços."
   },
   {
    "rot": "Saldo conforme medições",
    "p": "50",
    "via": "PIX",
    "cond": "O saldo será pago conforme medições aprovadas pelo CONTRATANTE, considerando apenas os serviços efetivamente concluídos, entregues e aceitos."
   },
   {
    "rot": "Retenção — Etapa final",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "colAmbiente": true,
  "crono": [
   [
    "Prazo de medição / produção",
    "A medição in loco será realizada mediante solicitação formal do contratante, e a produção será iniciada após a confirmação das medidas in loco."
   ],
   [
    "Prazo de instalação",
    "A instalação ocorrerá mediante agendamento prévio entre as partes, respeitando o cronograma da obra."
   ],
   [
    "Observação",
    "Fica estabelecido que os itens poderão ser liberados de forma parcial, conforme o progresso da obra."
   ]
  ],
  "caixa": {
   "titulo": "Informações gerais",
   "paras": [
    "Faz parte deste escopo o caderno executivo e as imagens, bem como todas as orientações para execução e instalação geral;",
    "Todas as estruturas deverão ser fabricadas em aço carbono galvanizado;",
    "As peças deverão ser adequadamente preparadas antes da pintura, garantindo maior resistência e qualidade;",
    "As peças não devem possuir soldas aparentes;",
    "Todas as peças deverão ser embaladas a fim de evitar danos antes da instalação;",
    "É de responsabilidade do fornecedor a instalação das peças com os devidos acessórios e material de acabamento;",
    "O prazo de garantia de defeitos de fabricação e oxidação das peças é de 5 (cinco) anos."
   ]
  },
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "un.",
    "d": "Estrutura metálica para vinhos na cor champanhe.",
    "etapa": 1,
    "amb": "Living"
   },
   {
    "tipo": "grupo",
    "d": "Estão incluídos neste escopo"
   },
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "• Medição técnica no local da obra;\n• Confecção das peças conforme projeto aprovado;\n• Instalação completa das peças;\n\n| Conforme orçamento descritivo anexo.",
    "etapa": 1,
    "amb": ""
   }
  ]
 },
 "personalizado": {
  "grupo": "Sem modelo",
  "nome": "Novo escopo (em branco)",
  "banda": "Escopo de serviços",
  "modo": "medicao",
  "garantia": [],
  "medicoes": [
   {
    "rot": "1ª Medição — Entrada / Etapa 01",
    "p": "25",
    "via": "PIX",
    "cond": "Corresponde a até 25% do valor total do contrato, referente à entrada e à conclusão da Etapa 01."
   },
   {
    "rot": "2ª Medição — Etapa 02",
    "p": "50",
    "via": "PIX",
    "cond": "Corresponde a 50% do valor total do contrato. Esta etapa poderá ser liberada por meio de medições parciais, porém o valor total correspondente à Etapa 02 somente poderá ser pago após a conclusão e aprovação dos serviços, na data previamente acordada."
   },
   {
    "rot": "3ª Medição — Etapa final / Retenção",
    "p": "25",
    "via": "PIX",
    "cond": "Retenção liberada somente após a conclusão integral de todos os serviços, entrega final e inexistência de pendências, mediante aceite formal."
   }
  ],
  "itens": [
   {
    "tipo": "item",
    "q": "1",
    "u": "vb",
    "d": "",
    "etapa": 1,
    "amb": ""
   }
  ]
 }
};

/* Os modelos agrupados como aparecem na escolha. A ordem dos grupos e a
   do proprio gerador — quem procura "pintura" ja sabe olhar em Obra
   civil. */
export function modelosPorGrupo() {
  const m = new Map();
  Object.entries(MODELOS_ESCOPO).forEach(([id, c]) => {
    const g = c.grupo || "Outros";
    if (!m.has(g)) m.set(g, []);
    m.get(g).push({ id, nome: c.nome, modo: c.modo });
  });
  return [...m.entries()].map(([grupo, itens]) => ({ grupo, itens }));
}

/* Sugere o modelo a partir do NOME DA VERBA da EAP.

   Quem seleciona a mao de obra de Pintura quer o escopo de pintura — e
   fazer a pessoa procurar numa lista de 24 depois de ja ter dito qual e o
   grupo e pedir a mesma informacao duas vezes. Erra pro lado de nao
   sugerir: modelo errado escolhido sozinho vira contrato errado. */
const POR_VERBA = {
  "05": "iluminacao", "06": "hidraulica", "09": "gas", "10": "gesso",
  "11": "revestimento", "13": "piso-vinilico", "18": "pintura-concluido",
  "19": "esquadrias", "20": "ar-conv", "21": "marcenaria-dalmobile",
  "22": "estrutura-metalica", "23": "vidros", "25": "estofados",
  "26": "marmoraria", "28": "eletros", "30": "cortinas",
};
export function modeloSugerido(verbaCanonica) {
  const id = POR_VERBA[verbaCanonica];
  return id && MODELOS_ESCOPO[id] ? id : null;
}
