// Dados sintéticos exclusivos do teste de interface. Não são carregados pelo app.
import React from 'react';
import {createRoot} from 'react-dom/client';
import DashboardPage from '../../web/src/features/dashboard/DashboardPage.jsx';

const names = ['R. Canto da Praia, 668','Ed. Meridian, 1301','Ed. Sixteen, 502','Ed. Vista Jardins, Viva Park, 612','Residencial Solar','Casa das Flores','Ed. Horizonte'];
const rows = names.map((name,i)=>({id:String(i),code:2498+i,name,squad:i%2?'Sun':'Comet',gc:i%2?'Maria':'Ana',unit:i%2?'São Paulo':'Florianópolis',delivery:'2026-12-18',days:[61,89,83,89,120,150,null][i],rank:i,summary:i<4?{mat:{total:550000,falta:500000,pct:10}}:null,steps:['Criativo','CMV','Especificação','Marcenaria','Executivo','Execução'].map((name,j)=>({chave:String(j),curto:name,rotulo:name,feito:j<3})),currentStep:'3',stage:'Aguardando Marcenaria',alerts:i<4?[{id:'alert'+i,critical:true,days:-7,title:'Compra de Louças, Metais e Equipamentos Especiais',text:'Compra de Louças, Metais e Equipamentos Especiais venceu há 7 dias',amount:2624.71,action:()=>{window.lastAction='resolve-'+i}}]:[]}));
window.renderDashboard=(props={})=>root.render(<DashboardPage rows={rows} onOpen={(id)=>{window.lastAction='open-'+id}} onRetry={()=>{window.lastAction='retry'}} {...props}/>);
const root=createRoot(document.getElementById('root'));window.renderDashboard();
