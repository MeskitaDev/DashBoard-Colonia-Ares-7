# 🔴 Colônia Ares-7 — Painel de Controle
#vibe-code #claude
---> https://meskitadev.github.io/DashBoard-Colonia-Ares-7/index.html

Dashboard de controle em tempo real de uma colônia humana **fictícia** em Marte, feito só com **HTML, CSS e JavaScript puro**. Ele mostra recursos vitais, gráficos ao vivo, alertas de tempestade de areia, a tripulação e um relógio marciano calculado com a fórmula real do *Coordinated Mars Time* (MTC).

<img width="1916" height="905" alt="image" src="https://github.com/user-attachments/assets/76176dcf-12ca-4531-8e84-555d0182b59c" />

> Todos os dados são simulados no próprio `script.js`. O projeto não usa nenhuma API externa.

---

## ✨ Funcionalidades

| Recurso | O que faz |
|---|---|
| **Cards de indicadores** | Oxigênio (%), Energia solar (kWh), Água (litros) e População. Atualizam sozinhos a cada 3 s com animação de contagem, variação percentual em verde ou vermelho e barra de progresso. |
| **Gráfico em tempo real** | Linha (Chart.js) com o consumo de oxigênio, energia e água nas últimas 24 horas marcianas. Recebe um ponto novo a cada 3 s e desliza para a esquerda, como um monitor. |
| **Energia por setor** | Gráfico de rosca com a distribuição entre Suporte de vida, Estufas, Habitação, Laboratório e Comunicações, com total no centro e legenda própria. |
| **Alerta de tempestade** | A cada 20–30 s aparece uma notificação com borda pulsante. Enquanto ela está ativa, a geração solar cai, o vento e a opacidade de poeira sobem e o status do cabeçalho muda. |
| **Relógios Terra / Marte** | Horário UTC, horário MTC e número do Sol (dia marciano), atualizados a cada segundo. |
| **Tripulação** | Tabela com 10 tripulantes, avatar com iniciais e status (Online, Em missão, Dormindo). Tem filtro por status e busca por nome que ignora acentos. |
| **Clima** | Temperatura, pressão, vento e opacidade atmosférica (τ) da estação externa. |
| **Comunicações** | Atraso do sinal Terra–Marte, contagem regressiva até a próxima janela da Deep Space Network (DSN) e taxa de dados. |
| **Registro de eventos** | Terminal que adiciona linhas automaticamente, com carimbo de Sol e hora marciana: `[Sol 54312 · 14:22] Estufa B: colheita concluída`. |

---

## 🛠️ Tecnologias

- **HTML5** semântico (`header`, `nav`, `main`, `section`, `article`)
- **CSS3**: glassmorphism com `backdrop-filter`, keyframes e textura de estrelas feita só com gradientes
- **JavaScript puro (vanilla)**, sem frameworks
- [**Tailwind CSS**](https://tailwindcss.com/) 3.4 via CDN
- [**Chart.js**](https://www.chartjs.org/) 4.4 via CDN
- Fontes [**Space Grotesk**](https://fonts.google.com/specimen/Space+Grotesk) (textos) e [**JetBrains Mono**](https://fonts.google.com/specimen/JetBrains+Mono) (números, relógios e terminal), via Google Fonts

---

## 📁 Estrutura

```
colonia-ares-7/
├── index.html    # Estrutura da página e marcação semântica
├── style.css     # Glassmorphism, animações, terminal e o que o Tailwind não cobre
├── script.js     # Toda a lógica: dados simulados, relógios, gráficos, alertas e filtros
└── docs/         # Imagens usadas neste README
```

O `script.js` está dividido em blocos comentados, cada um com uma responsabilidade:

1. Utilitários (formatação pt-BR, sorteios, animação de números)
2. Relógios (Terra UTC e Marte MTC)
3. Cards de indicadores
4. Clima e comunicações
5. Gráficos (linha em tempo real e rosca)
6. Alerta de tempestade de areia
7. Tripulação (lista, filtro e busca)
8. Registro de eventos (terminal)
9. Menu lateral (hambúrguer e seção ativa)
10. Inicialização

---

## 🪐 Como o horário marciano é calculado

O relógio de Marte usa o algoritmo *Mars24* da NASA GISS para chegar ao **Mars Sol Date (MSD)**:

```js
const jd    = Date.now() / 86400000 + 2440587.5;        // Data juliana
const jdTT  = jd + 69.184 / 86400;                      // Tempo terrestre (TT)
const msd   = (jdTT - 2405522.0028779) / 1.0274912517;  // Mars Sol Date
const mtc   = (msd % 1) * 24;                           // Horário MTC em horas
const sol   = Math.floor(msd);                          // Número do Sol
```

Um sol (dia marciano) dura cerca de **24 h 39 min 35 s**, por isso o relógio de Marte vai se afastando do da Terra ao longo do tempo.

---

## 👩‍💻 Autoria
ClaudeCode
Desenvolvido por **Júlia Sousa Mesquita (Meskita)** · [@MesquitaSukin](https://github.com/MesquitaSukin)
Projeto de estudo e portfólio. A Colônia Ares-7, os tripulantes e todos os dados são fictícios.
