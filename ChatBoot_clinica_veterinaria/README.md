# 🐾 Bicho Feliz – Assistente Virtual

Chatbot para a clínica veterinária **Bicho Feliz**, construído com HTML, CSS e JavaScript puros e integrado à API do **Google Gemini**.

---

## ✨ Funcionalidades

- 💬 Chat em tempo real com o modelo Gemini (gemini-2.0-flash-lite)
- 🩺 Prompt especializado em atendimento veterinário
- ⚡ Perguntas rápidas na barra lateral
- 🔄 Histórico de conversa mantido durante a sessão
- ⏳ Indicador de digitação animado durante o carregamento
- ❌ Tratamento de erros com mensagens claras ao usuário
- 🔑 Chave de API salva localmente no navegador (nunca enviada para servidores próprios)
- 📱 Layout responsivo (desktop e mobile)

---

## 🚀 Como executar localmente

### Pré-requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Uma chave de API gratuita do Google Gemini

### 1. Obter a chave de API

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Faça login com sua conta Google
3. Clique em **"Create API Key"**
4. Copie a chave gerada (começa com `AIzaSy...`)

### 2. Clonar o repositório

```bash
git clone https://github.com/<seu-usuario>/bicho-feliz-chatbot.git
cd bicho-feliz-chatbot
```

### 3. Abrir o projeto

**Opção A – Abrir diretamente no navegador (mais simples):**

```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

**Opção B – Servir com um servidor local (recomendado):**

```bash
# Python 3
python -m http.server 8000

# Node.js (requer: npm install -g serve)
serve .

# VS Code: instale a extensão "Live Server" e clique em "Go Live"
```

Depois acesse: `http://localhost:8000`

### 4. Inserir a chave de API

Ao abrir o projeto, um modal solicitará sua chave de API. Cole a chave e clique em **"Salvar e iniciar"**.

> A chave é armazenada apenas no `localStorage` do seu navegador. Ela nunca sai do seu dispositivo.

---

## 📁 Estrutura do projeto

```
bicho-feliz-chatbot/
├── index.html      → Estrutura da página (modal de configuração, chat, sidebar)
├── style.css       → Estilização completa (paleta verde-floresta + tipografia Nunito/Inter)
├── script.js       → Lógica do chat, integração com Gemini API, renderização de Markdown
└── README.md       → Este arquivo
```

> **Não há arquivo `.env`** porque este é um projeto puramente client-side. A chave de API é inserida pelo usuário diretamente no navegador e salva no `localStorage`. Nunca comite sua chave no repositório.

---

## 🔒 Segurança da chave de API

- ✅ A chave é armazenada apenas no `localStorage` do navegador do usuário
- ✅ Nenhum servidor intermediário recebe a chave
- ✅ O arquivo `.gitignore` (se houver variáveis de ambiente) impede commits acidentais
- ⚠️ Para produção, recomenda-se criar um backend que faça as chamadas à API, evitando expor a chave no frontend

---

## 🛠️ Personalização

### Trocar o modelo Gemini

No `script.js`, altere a constante:

```js
const GEMINI_MODEL = "gemini-2.0-flash-lite"; // trocar aqui
```

Modelos disponíveis: `gemini-2.0-flash-lite`, `gemini-2.0-flash`, `gemini-1.5-pro`

### Ajustar o comportamento do assistente

Edite a constante `SYSTEM_PROMPT` no `script.js` para customizar a personalidade, restrições e informações da clínica.

### Alterar as perguntas rápidas

No `index.html`, localize os botões com classe `quick-btn` e edite os atributos `data-q` e o texto exibido.

---

## 🌐 Deploy (GitHub Pages)

1. Faça push do repositório para o GitHub
2. Vá em **Settings → Pages**
3. Em **Source**, selecione `Deploy from a branch → main → / (root)`
4. Aguarde e acesse o link gerado

> Usuários precisarão inserir a própria chave de API ao acessar o site.

---

## 📦 Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura da página |
| CSS3 | Estilização e animações |
| JavaScript (ES6+) | Lógica, integração com API |
| Google Gemini API | Modelo de linguagem |
| Google Fonts | Nunito + Inter |
| localStorage | Persistência da chave de API |

---

## ⚠️ Aviso

Este chatbot fornece orientações gerais sobre saúde animal e **não substitui a consulta com um médico veterinário**. Para diagnósticos e tratamentos, consulte sempre um profissional habilitado.

---

*Desenvolvido como projeto educacional de integração com APIs de IA generativa.*
