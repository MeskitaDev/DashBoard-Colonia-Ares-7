/* ============================================================
   Colônia Ares-7 — lógica do painel (JavaScript puro)
   Todos os dados são fictícios e gerados aqui mesmo.

   Organização:
   1. Utilitários (formatação, sorteio, animação de números)
   2. Relógios (Terra UTC e Marte MTC)
   3. Cards de indicadores
   4. Clima e comunicações
   5. Gráficos (linha em tempo real e rosca por setor)
   6. Alerta de tempestade de areia
   7. Tripulação (lista, filtro e busca)
   8. Registro de eventos (terminal)
   9. Menu lateral (hambúrguer e seção ativa)
   10. Inicialização
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   1. UTILITÁRIOS
   ------------------------------------------------------------ */

const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Formata número no padrão brasileiro (1.234,5). */
function formatar(numero, casas = 0) {
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Número aleatório entre min e max. */
function sortear(min, max) {
  return Math.random() * (max - min) + min;
}

/** Inteiro aleatório entre min e max (inclusivo). */
function sortearInteiro(min, max) {
  return Math.floor(sortear(min, max + 1));
}

/** Escolhe um item qualquer de uma lista. */
function escolher(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

/** Mantém um valor dentro de um intervalo. */
function limitar(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

/** Dois dígitos: 7 -> "07". */
function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/**
 * Anima a contagem de um número dentro de um elemento,
 * do valor antigo até o novo, com desaceleração suave.
 */
function animarNumero(elemento, de, para, casas = 0, duracao = 900) {
  if (elemento._animacao) cancelAnimationFrame(elemento._animacao);

  if (menosMovimento || de === para) {
    elemento.textContent = formatar(para, casas);
    return;
  }

  const inicio = performance.now();
  const passo = (agora) => {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const suavizado = 1 - Math.pow(1 - progresso, 3); // ease-out cúbico
    elemento.textContent = formatar(de + (para - de) * suavizado, casas);
    if (progresso < 1) elemento._animacao = requestAnimationFrame(passo);
  };
  elemento._animacao = requestAnimationFrame(passo);
}

/* ------------------------------------------------------------
   2. RELÓGIOS — Terra (UTC) e Marte (MTC)
   ------------------------------------------------------------ */

/** Calcula o horário marciano (MTC) e o número do Sol. */
function calcularHorarioMarte(agoraMs = Date.now()) {
  const jd = agoraMs / 86400000 + 2440587.5;          // Data juliana
  const jdTT = jd + 69.184 / 86400;                    // Tempo terrestre
  const msd = (jdTT - 2405522.0028779) / 1.0274912517; // Mars Sol Date
  const mtcHoras = (msd % 1) * 24;
  return { msd, mtcHoras, sol: Math.floor(msd) };
}

/** Converte horas decimais em { h, m, s }. */
function horasParaPartes(horasDecimais) {
  const totalSegundos = Math.floor(horasDecimais * 3600);
  return {
    h: Math.floor(totalSegundos / 3600),
    m: Math.floor((totalSegundos % 3600) / 60),
    s: totalSegundos % 60,
  };
}

/** Texto curto "Sol 53712 · 14:22" usado no terminal e nos gráficos. */
function carimboMarciano() {
  const { mtcHoras, sol } = calcularHorarioMarte();
  const { h, m } = horasParaPartes(mtcHoras);
  return `Sol ${sol} · ${doisDigitos(h)}:${doisDigitos(m)}`;
}

const elRelogioTerra = document.getElementById('relogio-terra');
const elDataTerra = document.getElementById('data-terra');
const elRelogioMarte = document.getElementById('relogio-marte');
const elNumeroSol = document.getElementById('numero-sol');

function atualizarRelogios() {
  const agora = new Date();

  // Terra (UTC)
  elRelogioTerra.textContent =
    `${doisDigitos(agora.getUTCHours())}:${doisDigitos(agora.getUTCMinutes())}:${doisDigitos(agora.getUTCSeconds())}`;
  elDataTerra.textContent = agora.toLocaleDateString('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
  });

  // Marte (MTC)
  const { mtcHoras, sol } = calcularHorarioMarte(agora.getTime());
  const { h, m, s } = horasParaPartes(mtcHoras);
  elRelogioMarte.textContent = `${doisDigitos(h)}:${doisDigitos(m)}:${doisDigitos(s)}`;
  elNumeroSol.textContent = formatar(sol);
}

/* ------------------------------------------------------------
   3. CARDS DE INDICADORES
   ------------------------------------------------------------ */

// Estado de cada indicador. "historico" guarda as últimas leituras
// para calcular a variação (a "última hora" é simulada e comprimida).
const indicadores = {
  oxigenio:  { el: 'card-oxigenio',  valor: 94.2,   min: 88,     max: 99,     passo: 0.3, casas: 1, capacidade: 100,    historico: [] },
  energia:   { el: 'card-energia',   valor: 1842,   min: 1550,   max: 2250,   passo: 26,  casas: 0, capacidade: 2400,   historico: [] },
  agua:      { el: 'card-agua',      valor: 128450, min: 121000, max: 140000, passo: 260, casas: 0, capacidade: 150000, historico: [] },
  populacao: { el: 'card-populacao', valor: 247,    min: 240,    max: 260,    passo: 0,   casas: 0, capacidade: 300,    historico: [] },
};

// Geração "base" de energia (sem tempestade) e fator de redução atual.
let energiaBase = 1842;
let fatorTempestade = 1;
const TAMANHO_HISTORICO = 20; // 20 leituras × 3 s

/** Passeio aleatório suave, puxando de volta ao centro do intervalo. */
function variarSuavemente(valor, { min, max, passo }) {
  const centro = (min + max) / 2;
  const puxao = (centro - valor) * 0.04;
  return limitar(valor + sortear(-passo, passo) + puxao, min, max);
}

/** Calcula os novos valores de todos os indicadores. */
function calcularIndicadores() {
  const o2 = indicadores.oxigenio;
  o2.valor = variarSuavemente(o2.valor, o2);

  // Energia: a base varia e a tempestade aplica uma queda progressiva
  energiaBase = variarSuavemente(energiaBase, indicadores.energia);
  const alvoFator = tempestadeAtiva ? 0.52 : 1;
  fatorTempestade += (alvoFator - fatorTempestade) * 0.45;
  indicadores.energia.valor = energiaBase * fatorTempestade;

  const agua = indicadores.agua;
  agua.valor = variarSuavemente(agua.valor, agua);

  // População: muda raramente (chegadas, nascimentos, retornos)
  const pop = indicadores.populacao;
  if (Math.random() < 0.06) {
    const delta = Math.random() < 0.7 ? 1 : -1;
    pop.valor = limitar(pop.valor + delta, pop.min, pop.max);
    registrarEvento(
      delta > 0 ? 'Habitação: novo morador registrado no módulo C' : 'Habitação: transferência para a estação orbital Phobos-1',
      'ok'
    );
  }
}

/** Atualiza o visual de um card (valor animado, variação e barra). */
function renderizarCard(chave) {
  const ind = indicadores[chave];
  const card = document.getElementById(ind.el);
  const elValor = card.querySelector('[data-valor]');
  const elVariacao = card.querySelector('[data-variacao]');
  const elBarra = card.querySelector('[data-barra]');
  const elProgresso = card.querySelector('[role="progressbar"]');

  // Valor com contagem animada
  const anterior = ind.exibido ?? ind.valor;
  const novo = ind.casas ? Number(ind.valor.toFixed(ind.casas)) : Math.round(ind.valor);
  animarNumero(elValor, anterior, novo, ind.casas);
  ind.exibido = novo;

  // Variação em relação à leitura mais antiga do histórico
  ind.historico.push(novo);
  if (ind.historico.length > TAMANHO_HISTORICO) ind.historico.shift();
  const referencia = ind.historico[0];
  const variacao = referencia ? ((novo - referencia) / referencia) * 100 : 0;
  const sinal = variacao > 0 ? '+' : variacao < 0 ? '−' : '±';
  elVariacao.textContent = `${sinal}${formatar(Math.abs(variacao), 1)}% na última hora`;
  elVariacao.classList.toggle('sobe', variacao > 0.05);
  elVariacao.classList.toggle('desce', variacao < -0.05);

  // Barra de progresso
  const pct = limitar((novo / ind.capacidade) * 100, 0, 100);
  elBarra.style.width = `${pct}%`;
  elProgresso.setAttribute('aria-valuenow', Math.round(pct));
}

/** Ciclo completo dos cards (chamado a cada 3 segundos). */
function atualizarCards() {
  calcularIndicadores();
  Object.keys(indicadores).forEach(renderizarCard);

  // Destaque visual no card de energia durante a tempestade
  const cardEnergia = document.getElementById('card-energia');
  cardEnergia.classList.toggle('em-tempestade', tempestadeAtiva);
  cardEnergia.querySelector('[data-sub]').textContent = tempestadeAtiva
    ? 'Queda por tempestade de areia'
    : 'Geração no sol atual';
}

/* ------------------------------------------------------------
   4. CLIMA E COMUNICAÇÕES
   ------------------------------------------------------------ */

const clima = { temp: -63, pressao: 6.1, vento: 18, tau: 0.52 };
let atrasoSinalSeg = 761;         // ~12 min 41 s
let janelaDsnSeg = sortearInteiro(240, 900);

function atualizarClima() {
  const alvoVento = tempestadeAtiva ? 78 : 18;
  const alvoTau = tempestadeAtiva ? 2.1 : 0.52;
  clima.vento += (alvoVento - clima.vento) * 0.3 + sortear(-2, 2);
  clima.tau += (alvoTau - clima.tau) * 0.25 + sortear(-0.02, 0.02);
  clima.temp = limitar(clima.temp + sortear(-0.6, 0.6), -80, -40);
  clima.pressao = limitar(clima.pressao + sortear(-0.02, 0.02), 5.8, 6.5);

  document.getElementById('clima-temp').textContent = formatar(clima.temp, 0);
  document.getElementById('clima-pressao').textContent = formatar(clima.pressao, 2);
  document.getElementById('clima-vento').textContent = formatar(Math.max(0, clima.vento), 0);
  document.getElementById('clima-tau').textContent = formatar(Math.max(0, clima.tau), 2);

  const selo = document.getElementById('selo-clima');
  const perigoso = clima.tau > 1;
  selo.textContent = perigoso ? 'Poeira intensa' : clima.tau > 0.7 ? 'Céu enevoado' : 'Céu limpo';
  selo.classList.toggle('perigo', perigoso);

  document.getElementById('com-taxa').textContent = formatar(
    tempestadeAtiva ? sortear(0.4, 0.9) : sortear(1.8, 2.4), 1
  );
}

/** Contagem regressiva da janela DSN e atraso do sinal (a cada segundo). */
function atualizarComunicacoes() {
  janelaDsnSeg -= 1;
  if (janelaDsnSeg <= 0) {
    registrarEvento('Comunicações: janela DSN aberta — pacote de telemetria enviado à Terra', 'ok');
    janelaDsnSeg = sortearInteiro(600, 1200);
  }
  document.getElementById('com-janela').textContent =
    `${doisDigitos(Math.floor(janelaDsnSeg / 60))}:${doisDigitos(janelaDsnSeg % 60)}`;

  // O atraso muda muito devagar conforme os planetas se movem
  if (Math.random() < 0.05) atrasoSinalSeg += 1;
  document.getElementById('com-atraso').textContent =
    `${Math.floor(atrasoSinalSeg / 60)} min ${doisDigitos(atrasoSinalSeg % 60)} s`;
}

/* ------------------------------------------------------------
   5. GRÁFICOS (Chart.js)
   ------------------------------------------------------------ */

const CORES = {
  laranja: '#F97316',
  ferrugem: '#B45309',
  telha: '#9A3412',
  areia: '#FDBA74',
  ciano: '#22D3EE',
  texto: '#A8A29E',
  grade: 'rgba(253, 186, 116, 0.08)',
};

let graficoConsumo = null;
let graficoSetores = null;
let horaSimulada = 0; // hora marciana do último ponto do gráfico

/** Consumo fictício por hora, com ciclo diário (mais uso durante o dia). */
function gerarConsumo(hora) {
  const ciclo = Math.sin(((hora - 6) / 24) * Math.PI * 2); // pico ao meio-dia
  return {
    oxigenio: +(18 + ciclo * 3 + sortear(-1.2, 1.2)).toFixed(1),       // kg/h
    energia: +(76 + ciclo * 14 + sortear(-4, 4)).toFixed(1),           // kWh/h
    agua: +(52 + ciclo * 9 + sortear(-3, 3)).toFixed(1),               // L/h
  };
}

function rotuloHora(hora) {
  return `${doisDigitos(((hora % 24) + 24) % 24)}h`;
}

/** Gradiente vertical para preencher a área sob cada linha. */
function gradiente(contexto, cor) {
  const { ctx, chartArea } = contexto.chart;
  if (!chartArea) return 'transparent';
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, cor + '40');
  g.addColorStop(1, cor + '00');
  return g;
}

function criarGraficoConsumo() {
  const horaAtual = Math.floor(calcularHorarioMarte().mtcHoras);
  const rotulos = [];
  const dados = { oxigenio: [], energia: [], agua: [] };

  for (let i = 23; i >= 0; i--) {
    const hora = horaAtual - i;
    const leitura = gerarConsumo(hora);
    rotulos.push(rotuloHora(hora));
    dados.oxigenio.push(leitura.oxigenio);
    dados.energia.push(leitura.energia);
    dados.agua.push(leitura.agua);
  }
  horaSimulada = horaAtual;

  const conjunto = (rotulo, dadosSerie, cor) => ({
    label: rotulo,
    data: dadosSerie,
    borderColor: cor,
    backgroundColor: (c) => gradiente(c, cor),
    fill: true,
    tension: 0.4,
    borderWidth: 2,
    pointRadius: (c) => (c.dataIndex === c.dataset.data.length - 1 ? 4 : 0),
    pointBackgroundColor: cor,
    pointHoverRadius: 5,
  });

  graficoConsumo = new Chart(document.getElementById('grafico-consumo'), {
    type: 'line',
    data: {
      labels: rotulos,
      datasets: [
        conjunto('Energia (kWh/h)', dados.energia, CORES.laranja),
        conjunto('Água (L/h)', dados.agua, CORES.areia),
        conjunto('Oxigênio (kg/h)', dados.oxigenio, CORES.ciano),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: menosMovimento ? 0 : 600 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: CORES.texto, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 10, 7, 0.95)',
          borderColor: 'rgba(253, 186, 116, 0.25)',
          borderWidth: 1,
          titleColor: '#FDBA74',
          bodyColor: '#F5EDE6',
          padding: 10,
          callbacks: {
            title: (itens) => `Hora marciana ${itens[0].label}`,
            label: (item) => ` ${item.dataset.label}: ${formatar(item.parsed.y, 1)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: CORES.grade }, ticks: { color: CORES.texto, maxRotation: 0, autoSkipPadding: 14 } },
        y: { grid: { color: CORES.grade }, ticks: { color: CORES.texto }, suggestedMin: 0, suggestedMax: 110 },
      },
    },
  });
}

/** Adiciona um novo ponto e remove o mais antigo (efeito de monitor). */
function atualizarGraficoConsumo() {
  horaSimulada += 1;
  const leitura = gerarConsumo(horaSimulada);
  const { data } = graficoConsumo;

  data.labels.push(rotuloHora(horaSimulada));
  data.labels.shift();
  [leitura.energia, leitura.agua, leitura.oxigenio].forEach((valor, i) => {
    data.datasets[i].data.push(valor);
    data.datasets[i].data.shift();
  });
  graficoConsumo.update();
}

// Setores e participação aproximada no consumo de energia
const setores = [
  { nome: 'Suporte de vida', valor: 640, cor: CORES.ciano },
  { nome: 'Estufas',         valor: 480, cor: CORES.laranja },
  { nome: 'Habitação',       valor: 330, cor: CORES.areia },
  { nome: 'Laboratório',     valor: 250, cor: CORES.ferrugem },
  { nome: 'Comunicações',    valor: 140, cor: CORES.telha },
];

function criarGraficoSetores() {
  graficoSetores = new Chart(document.getElementById('grafico-setores'), {
    type: 'doughnut',
    data: {
      labels: setores.map((s) => s.nome),
      datasets: [{
        data: setores.map((s) => s.valor),
        backgroundColor: setores.map((s) => s.cor),
        borderColor: '#140a07',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: { duration: menosMovimento ? 0 : 700 },
      plugins: {
        legend: { display: false }, // usamos uma legenda própria em HTML
        tooltip: {
          backgroundColor: 'rgba(20, 10, 7, 0.95)',
          bodyColor: '#F5EDE6',
          callbacks: { label: (item) => ` ${item.label}: ${formatar(item.parsed)} kWh` },
        },
      },
    },
  });
  renderizarLegendaSetores();
}

function renderizarLegendaSetores() {
  const total = setores.reduce((soma, s) => soma + s.valor, 0);
  document.getElementById('total-setores').textContent = formatar(total);

  document.getElementById('legenda-setores').innerHTML = setores
    .map((s) => `
      <li class="legenda-item">
        <span class="legenda-cor" style="background:${s.cor}"></span>
        ${s.nome}
        <b>${formatar((s.valor / total) * 100, 0)}%</b>
      </li>`)
    .join('');
}

/** Pequenas oscilações no consumo por setor. */
function atualizarGraficoSetores() {
  setores.forEach((s) => { s.valor = Math.max(60, Math.round(s.valor + sortear(-12, 12))); });
  graficoSetores.data.datasets[0].data = setores.map((s) => s.valor);
  graficoSetores.update();
  renderizarLegendaSetores();
}

/* ------------------------------------------------------------
   6. ALERTA DE TEMPESTADE DE AREIA
   ------------------------------------------------------------ */

const elAlerta = document.getElementById('alerta-tempestade');
let tempestadeAtiva = false;
let temporizadorFimTempestade = null;

/** Agenda a próxima tempestade para daqui a 20–30 segundos. */
function agendarTempestade() {
  setTimeout(mostrarTempestade, sortearInteiro(20000, 30000));
}

function mostrarTempestade() {
  tempestadeAtiva = true;
  elAlerta.classList.remove('saindo');
  elAlerta.hidden = false;

  document.getElementById('status-geral').textContent = 'Operacional · alerta de tempestade';
  document.querySelector('.ponto-pulsante').classList.add('atencao');
  registrarEvento('Meteorologia: tempestade de areia detectada no setor norte (ETA 14 min)', 'perigo');
  registrarEvento('Energia: painéis solares em modo de proteção', 'aviso');
  atualizarCards();

  // Se ninguém dispensar, a tempestade "passa" depois de 18 s
  temporizadorFimTempestade = setTimeout(() => esconderTempestade('passou'), 18000);
}

function esconderTempestade(motivo = 'dispensado') {
  if (!tempestadeAtiva) return;
  clearTimeout(temporizadorFimTempestade);
  tempestadeAtiva = false;

  elAlerta.classList.add('saindo');
  setTimeout(() => { elAlerta.hidden = true; }, menosMovimento ? 0 : 350);

  document.getElementById('status-geral').textContent = 'Sistemas operacionais';
  document.querySelector('.ponto-pulsante').classList.remove('atencao');
  registrarEvento(
    motivo === 'passou'
      ? 'Meteorologia: tempestade dissipada — painéis retomando captação'
      : 'Controle: alerta de tempestade reconhecido pela equipe',
    'ok'
  );
  agendarTempestade();
}

/* ------------------------------------------------------------
   7. TRIPULAÇÃO — lista, filtro por status e busca por nome
   ------------------------------------------------------------ */

const tripulacao = [
  { nome: 'Lúcia Montenegro',   funcao: 'Comandante',                 setor: 'Centro de controle', status: 'online' },
  { nome: 'Ana Ribeiro',        funcao: 'Engenheira-chefe',           setor: 'Matriz de energia',  status: 'online' },
  { nome: 'Tomás Okafor',       funcao: 'Botânico',                   setor: 'Estufa B',           status: 'missao' },
  { nome: 'Helena Duarte',      funcao: 'Médica',                     setor: 'Enfermaria',         status: 'online' },
  { nome: 'Rafael Ikeda',       funcao: 'Geólogo',                    setor: 'Delta de Jezero',    status: 'missao' },
  { nome: 'Bruno Castellano',   funcao: 'Técnico de suporte de vida', setor: 'Suporte de vida',    status: 'dormindo' },
  { nome: 'Yara Moraes',        funcao: 'Astrobióloga',               setor: 'Laboratório',        status: 'online' },
  { nome: 'Igor Valente',       funcao: 'Piloto de rover',            setor: 'Setor norte',        status: 'missao' },
  { nome: 'Sofia Albuquerque',  funcao: 'Engenheira de comunicações', setor: 'Antenas',            status: 'dormindo' },
  { nome: 'Marcos Nunes',       funcao: 'Meteorologista',             setor: 'Estação externa',    status: 'online' },
];

const ROTULO_STATUS = { online: 'Online', missao: 'Em missão', dormindo: 'Dormindo' };
const CORES_AVATAR = ['#FDBA74', '#F97316', '#22D3EE', '#FCD34D', '#FB923C', '#67E8F9', '#FDE68A'];

const filtroTripulacao = { status: 'todos', busca: '' };

/** Remove acentos e deixa minúsculo, para a busca ignorar "á", "ç" etc. */
function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function iniciais(nome) {
  const partes = nome.split(' ');
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corAvatar(nome) {
  let soma = 0;
  for (const letra of nome) soma += letra.charCodeAt(0);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function renderizarTripulacao() {
  const busca = normalizar(filtroTripulacao.busca.trim());
  const visiveis = tripulacao.filter((t) =>
    (filtroTripulacao.status === 'todos' || t.status === filtroTripulacao.status) &&
    normalizar(t.nome).includes(busca)
  );

  document.getElementById('lista-tripulacao').innerHTML = visiveis
    .map((t) => `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <span class="avatar" style="background:${corAvatar(t.nome)}" role="img" aria-label="Avatar de ${t.nome}">${iniciais(t.nome)}</span>
            <span class="font-medium">${t.nome}</span>
          </div>
        </td>
        <td class="secundario">${t.funcao}</td>
        <td class="secundario">${t.setor}</td>
        <td><span class="badge badge-${t.status}">${ROTULO_STATUS[t.status]}</span></td>
      </tr>`)
    .join('');

  document.getElementById('sem-resultados').hidden = visiveis.length > 0;

  // Contagem em cada botão de filtro
  const contagens = { todos: tripulacao.length, online: 0, missao: 0, dormindo: 0 };
  tripulacao.forEach((t) => { contagens[t.status] += 1; });
  document.querySelectorAll('[data-contagem]').forEach((el) => {
    el.textContent = contagens[el.dataset.contagem];
  });
}

function configurarFiltrosTripulacao() {
  document.querySelectorAll('#filtros-status .filtro').forEach((botao) => {
    botao.addEventListener('click', () => {
      filtroTripulacao.status = botao.dataset.status;
      document.querySelectorAll('#filtros-status .filtro').forEach((b) => {
        const ativo = b === botao;
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-pressed', String(ativo));
      });
      renderizarTripulacao();
    });
  });

  document.getElementById('busca-tripulante').addEventListener('input', (evento) => {
    filtroTripulacao.busca = evento.target.value;
    renderizarTripulacao();
  });
}

/** De tempos em tempos alguém muda de status (sai em missão, acorda...). */
function alternarStatusAleatorio() {
  const pessoa = escolher(tripulacao);
  const opcoes = Object.keys(ROTULO_STATUS).filter((s) => s !== pessoa.status);
  const novo = escolher(opcoes);
  const mensagens = {
    online: `${pessoa.nome} está de volta ao posto (${pessoa.setor})`,
    missao: `${pessoa.nome} iniciou atividade extraveicular`,
    dormindo: `${pessoa.nome} entrou no turno de descanso`,
  };
  pessoa.status = novo;
  registrarEvento(`Tripulação: ${mensagens[novo]}`);
  renderizarTripulacao();
}

/* ------------------------------------------------------------
   8. REGISTRO DE EVENTOS (terminal)
   ------------------------------------------------------------ */

const elRegistro = document.getElementById('registro-eventos');
const MAX_LINHAS = 40;

const EVENTOS_ROTINA = [
  ['Estufa B: colheita concluída (42 kg de batata)', 'ok'],
  ['Estufa A: umidade ajustada para 68%', ''],
  ['Reciclador de água: ciclo concluído, recuperação de 98,1%', 'ok'],
  ['Painéis solares: limpeza automática do arranjo 3', ''],
  ['Eletrólise: produção de O₂ estável em 1,9 kg/h', 'ok'],
  ['Rover Curupira: chegou ao ponto de coleta 7', ''],
  ['Laboratório: amostra JZ-118 catalogada', ''],
  ['Escudo de radiação: dose diária dentro do limite', 'ok'],
  ['Habitação: filtro de CO₂ do módulo C substituído', ''],
  ['Perfuratriz de gelo: 320 L extraídos no último ciclo', 'ok'],
  ['Comunicações: recebida mensagem do Centro de Controle (Terra)', ''],
  ['Suporte de vida: pressão interna em 101,2 kPa', ''],
  ['Baterias: banco 2 em 87% de carga', ''],
  ['Enfermaria: check-up semanal concluído para 6 tripulantes', 'ok'],
  ['Sensor sísmico: microtremor de magnitude 1,2 registrado', 'aviso'],
  ['Estufa C: falha no aspersor 4, equipe notificada', 'aviso'],
];

/** Adiciona uma linha ao terminal com o carimbo de Sol e hora marciana. */
function registrarEvento(texto, nivel = '') {
  const linha = document.createElement('li');
  const carimbo = document.createElement('span');
  carimbo.className = 'carimbo';
  carimbo.textContent = `[${carimboMarciano()}] `;
  const mensagem = document.createElement('span');
  if (nivel) mensagem.className = `nivel-${nivel}`;
  mensagem.textContent = texto;
  linha.append(carimbo, mensagem);
  elRegistro.append(linha);

  while (elRegistro.children.length > MAX_LINHAS) elRegistro.firstElementChild.remove();
  elRegistro.scrollTop = elRegistro.scrollHeight;
}

/** Agenda novas linhas de rotina em intervalos irregulares (3–6 s). */
function agendarEventoRotina() {
  setTimeout(() => {
    const [texto, nivel] = escolher(EVENTOS_ROTINA);
    registrarEvento(texto, nivel);
    agendarEventoRotina();
  }, sortearInteiro(3000, 6000));
}

/* ------------------------------------------------------------
   9. MENU LATERAL (hambúrguer no celular + seção ativa)
   ------------------------------------------------------------ */

function configurarMenu() {
  const barra = document.getElementById('barra-lateral');
  const sobreposicao = document.getElementById('sobreposicao');
  const btnAbrir = document.getElementById('btn-abrir-menu');
  const btnFechar = document.getElementById('btn-fechar-menu');

  const abrir = () => {
    barra.classList.add('aberta');
    sobreposicao.hidden = false;
    btnAbrir.setAttribute('aria-expanded', 'true');
  };
  const fechar = () => {
    barra.classList.remove('aberta');
    sobreposicao.hidden = true;
    btnAbrir.setAttribute('aria-expanded', 'false');
  };

  btnAbrir.addEventListener('click', abrir);
  btnFechar.addEventListener('click', fechar);
  sobreposicao.addEventListener('click', fechar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  barra.querySelectorAll('.link-nav').forEach((link) => link.addEventListener('click', fechar));

  // Destaca no menu a seção visível na tela
  const links = document.querySelectorAll('.link-nav');
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      links.forEach((l) => {
        const ativo = l.dataset.secao === entrada.target.id;
        l.classList.toggle('ativo', ativo);
        if (ativo) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-35% 0px -55% 0px' });

  document.querySelectorAll('main section[id]').forEach((s) => observador.observe(s));
}

/* ------------------------------------------------------------
   10. INICIALIZAÇÃO
   ------------------------------------------------------------ */

function iniciar() {
  // Fontes e cores padrão dos gráficos
  Chart.defaults.font.family = '"JetBrains Mono", ui-monospace, monospace';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = CORES.texto;

  configurarMenu();

  // Relógios: atualizam a cada segundo
  atualizarRelogios();
  setInterval(atualizarRelogios, 1000);

  // Primeiras linhas do terminal
  registrarEvento('Sistema: painel de controle iniciado', 'ok');
  registrarEvento('Suporte de vida: todos os parâmetros nominais', 'ok');
  registrarEvento('Estufa B: colheita concluída', 'ok');

  // Cards, clima e gráficos
  atualizarCards();
  atualizarClima();
  atualizarComunicacoes();
  criarGraficoConsumo();
  criarGraficoSetores();

  // Tripulação
  configurarFiltrosTripulacao();
  renderizarTripulacao();

  // Atualizações periódicas
  setInterval(() => {
    atualizarCards();
    atualizarClima();
    atualizarGraficoConsumo();
  }, 3000);
  setInterval(atualizarComunicacoes, 1000);
  setInterval(atualizarGraficoSetores, 6000);
  setInterval(alternarStatusAleatorio, 25000);

  agendarEventoRotina();
  agendarTempestade();

  document.getElementById('btn-dispensar-alerta').addEventListener('click', () => esconderTempestade('dispensado'));
}

document.addEventListener('DOMContentLoaded', iniciar);
