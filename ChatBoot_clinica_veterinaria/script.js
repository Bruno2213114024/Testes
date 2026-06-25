/* ============================================================
   BICHO FELIZ – Assistente Virtual
   RAG Local: clinica.json → system prompt → Gemini API
   ============================================================ */

"use strict";

// ── Constantes ───────────────────────────────────────────────
const GEMINI_MODEL    = "gemini-2.5-flash";
const GEMINI_ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const CLINICA_JSON_PATH = "clinica.json";
const STORAGE_KEY   = "bichofelize_api_key";
const MAX_HISTORY   = 20;
const MAX_RETRIES   = 3;
const RETRY_DELAYS  = [5000, 15000, 30000];

// ── Estado global ─────────────────────────────────────────────
let apiKey        = "";
let isLoading     = false;
let currentView   = "chat";
let conversation  = [];
let clinicaData   = null;   // JSON carregado via fetch()
let systemPrompt  = "";     // montado após carregar o JSON

// ── DOM – Chat ────────────────────────────────────────────────
const chatMessages = document.getElementById("chatMessages");
const userInput    = document.getElementById("userInput");
const sendBtn      = document.getElementById("sendBtn");
const charCount    = document.getElementById("charCount");
const chatView     = document.getElementById("chatView");

// ── DOM – Header ──────────────────────────────────────────────
const openConfigBtn = document.getElementById("openConfigBtn");
const statusDot     = document.getElementById("statusDot");
const statusText    = document.getElementById("statusText");

// ── DOM – Config ──────────────────────────────────────────────
const configView          = document.getElementById("configView");
const configStatusBox     = document.getElementById("configStatusBox");
const configStatusIcon    = document.getElementById("configStatusIcon");
const configStatusTitle   = document.getElementById("configStatusTitle");
const configStatusDesc    = document.getElementById("configStatusDesc");
const configCurrentRow    = document.getElementById("configCurrentRow");
const configCurrentKey    = document.getElementById("configCurrentKey");
const removeKeyBtn        = document.getElementById("removeKeyBtn");
const newApiKeyInput      = document.getElementById("newApiKeyInput");
const toggleVisibilityBtn = document.getElementById("toggleVisibilityBtn");
const validateBtn         = document.getElementById("validateBtn");
const saveNewKeyBtn       = document.getElementById("saveNewKeyBtn");
const validationFeedback  = document.getElementById("validationFeedback");
const validationIcon      = document.getElementById("validationIcon");
const validationMsg       = document.getElementById("validationMsg");

// ── DOM – RAG badge ───────────────────────────────────────────
const ragBadge = document.getElementById("ragBadge");
const ragDot   = document.getElementById("ragDot");
const ragLabel = document.getElementById("ragLabel");

// ════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════
(async function init() {
  // 1. Timestamp mensagem de boas-vindas
  const timeEl = document.querySelector("#welcomeMessage .msg-time");
  if (timeEl) timeEl.textContent = formatTime(new Date());

  // 2. Carrega a chave salva
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    apiKey = stored;
    setHeaderStatus("online", "Assistente Online");
  } else {
    setHeaderStatus("offline", "Sem chave API");
  }

  // 3. ── RAG: carrega o clinica.json ──────────────────────
  setRagStatus("loading", "Carregando catálogo...");

  // Detecta abertura direta por file:// e avisa antes mesmo de tentar
  if (location.protocol === "file:") {
    setRagStatus("error", "Servidor local necessário");
    systemPrompt = buildSystemPromptFallback();
    appendMessage("error",
      "🚫 <strong>Arquivo aberto diretamente pelo navegador (file://).</strong><br><br>" +
      "O catálogo de serviços não pode ser carregado assim. Você precisa usar um servidor local:<br><br>" +
      "1. Abra o terminal na pasta do projeto<br>" +
      "2. Execute: <code>npx serve .</code><br>" +
      "3. Acesse <strong>http://localhost:3000</strong> no navegador<br><br>" +
      "O assistente funcionará sem preços até isso ser corrigido.");
  } else {
    try {
      const resp = await fetch(CLINICA_JSON_PATH);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      validateClinicaJson(json);
      clinicaData  = json;
      systemPrompt = buildSystemPrompt(json);
      const total  = json.servicos.length;
      setRagStatus("ok", `Catálogo carregado (${total} serviços)`);
    } catch (err) {
      setRagStatus("error", "Falha ao carregar catálogo");
      console.error("[RAG] Erro ao carregar clinica.json:", err);
      systemPrompt = buildSystemPromptFallback();
      appendMessage("error",
        "⚠️ Não foi possível carregar o catálogo (<code>clinica.json</code>). " +
        "Verifique se o arquivo está na mesma pasta que o <code>index.html</code> e acesse via <code>npx serve .</code>.");
    }
  }

  // 4. Abre config automaticamente se não há chave
  if (!apiKey) setTimeout(() => switchView("config"), 400);

  // 5. Eventos – sidebar
  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.q;
      if (q && !isLoading) {
        if (currentView === "config") switchView("chat");
        userInput.value = q;
        updateCharCount();
        sendMessage();
      }
    });
  });

  // 6. Eventos – input
  userInput.addEventListener("input", () => { autoResize(userInput); updateCharCount(); });
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isLoading) sendMessage(); }
  });
  sendBtn.addEventListener("click", () => { if (!isLoading) sendMessage(); });

  // 7. Eventos – nav
  openConfigBtn.addEventListener("click", () =>
    switchView(currentView === "config" ? "chat" : "config"));

  // 8. Eventos – config page
  toggleVisibilityBtn.addEventListener("click", toggleKeyVisibility);
  validateBtn.addEventListener("click", handleValidateKey);
  saveNewKeyBtn.addEventListener("click", handleSaveNewKey);
  removeKeyBtn.addEventListener("click", handleRemoveKey);
  newApiKeyInput.addEventListener("input", resetValidationFeedback);
  newApiKeyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleValidateKey(); });
})();

// ════════════════════════════════════════════════════════════
//  RAG – Carregamento e montagem do contexto
// ════════════════════════════════════════════════════════════

/** Valida a estrutura mínima esperada do JSON */
function validateClinicaJson(json) {
  if (!json.clinica)   throw new Error("Campo 'clinica' ausente");
  if (!Array.isArray(json.servicos) || json.servicos.length === 0)
    throw new Error("Campo 'servicos' ausente ou vazio");
  for (const s of json.servicos) {
    if (!s.nome || s.preco === undefined || !s.descricao)
      throw new Error(`Serviço com campos obrigatórios faltando: ${JSON.stringify(s)}`);
  }
}

/** Monta o system prompt completo injetando o JSON da clínica */
function buildSystemPrompt(json) {
  const { clinica, servicos } = json;

  // Serializa serviços em texto estruturado legível para o modelo
  const categorias = [...new Set(servicos.map((s) => s.categoria))];
  let catalogoTexto = "";

  for (const cat of categorias) {
    const grupo = servicos.filter((s) => s.categoria === cat);
    catalogoTexto += `\n### ${cat}\n`;
    for (const s of grupo) {
      const especies = s.especies ? ` [${s.especies.join(", ")}]` : "";
      catalogoTexto +=
        `- **${s.nome}**${especies}: R$ ${s.preco.toFixed(2).replace(".", ",")}\n` +
        `  ${s.descricao}\n`;
    }
  }

  return `Você é o assistente virtual da clínica veterinária "${clinica.nome}", localizada no Brasil.

## DADOS DA CLÍNICA (use sempre estas informações — não invente dados)
- Telefone: ${clinica.telefone}
- Horário segunda a sexta: ${clinica.horarios.segunda_sexta}
- Horário sábado: ${clinica.horarios.sabado}
- Domingo: ${clinica.horarios.domingo}
- Formas de pagamento: ${clinica.formas_pagamento?.aceitas?.join(", ") || "Não informado"}
- Parcelamento: ${clinica.formas_pagamento?.parcelamento || "Não informado"}
- Observação: ${clinica.observacoes}

## CATÁLOGO COMPLETO DE SERVIÇOS E PREÇOS
${catalogoTexto}

## REGRAS OBRIGATÓRIAS SOBRE PREÇOS E SERVIÇOS
1. NUNCA invente preços. Use APENAS os valores do catálogo acima.
2. Se o usuário perguntar sobre um serviço que NÃO está no catálogo, diga claramente que não temos essa informação cadastrada e sugira ligar para a clínica.
3. Ao citar um preço, informe sempre o valor exato do catálogo e uma breve descrição do serviço.
4. Para comparar opções (ex: castração por porte), liste todas as variações disponíveis no catálogo.
5. Se o usuário pedir "todos os preços" ou "tabela completa", apresente os serviços organizados por categoria com os valores exatos.

## DIRETRIZES GERAIS
- Responda sempre em português brasileiro, de forma amigável, empática e acessível.
- Nunca forneça diagnósticos definitivos; sempre recomende consulta presencial com veterinário.
- Para emergências (dificuldade respiratória, convulsões, envenenamento, sangramento intenso), oriente o tutor a ir imediatamente a uma clínica.
- Mantenha as respostas focadas em animais de companhia comuns: cães, gatos, pássaros, pequenos roedores e peixes.
- Quando mencionar procedimentos ou medicamentos, reforce que apenas o veterinário pode prescrever.
- Use linguagem calorosa e demonstre que você se importa com o bem-estar dos animais e seus tutores.
- Seja conciso: prefira respostas com até 6 parágrafos ou listas curtas.`;
}

/** Prompt de fallback quando o JSON não carrega */
function buildSystemPromptFallback() {
  return `Você é o assistente virtual da clínica veterinária "Bicho Feliz", localizada no Brasil.
Responda sempre em português brasileiro, de forma amigável e empática.
IMPORTANTE: O catálogo de serviços não está disponível no momento. Não informe preços. Oriente o usuário a ligar para a clínica para obter informações sobre valores e serviços.
Nunca forneça diagnósticos definitivos; sempre recomende consulta presencial com veterinário.
Para emergências, oriente a ir imediatamente a uma clínica.`;
}

// ── RAG: busca local para enriquecer mensagens de preço ──────
/**
 * Faz uma busca nos serviços do JSON para encontrar correspondências
 * com o texto da mensagem do usuário. Retorna os serviços mais relevantes.
 */
function ragSearch(query) {
  if (!clinicaData) return [];
  const q = query.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos

  return clinicaData.servicos.filter((s) => {
    const haystack = (s.nome + " " + s.descricao + " " + (s.categoria || "") + " " + (s.especies || []).join(" "))
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Divide a query em tokens e verifica se algum aparece
    return q.split(/\s+/).some((token) => token.length > 2 && haystack.includes(token));
  });
}

/** Status visual do RAG na sidebar */
function setRagStatus(state, label) {
  ragBadge.className = `rag-badge ${state}`;
  ragLabel.textContent = label;
}

// ════════════════════════════════════════════════════════════
//  ENVIO DE MENSAGEM
// ════════════════════════════════════════════════════════════
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) { shakeInput(); return; }
  if (!apiKey) { switchView("config"); return; }

  appendMessage("user", text);
  userInput.value = "";
  autoResize(userInput);
  updateCharCount();

  // RAG: busca serviços relevantes para enriquecer contexto pontual
  const hits = ragSearch(text);

  conversation.push({ role: "user", parts: [{ text }] });
  trimHistory();

  const typingEl = appendTypingIndicator();
  setLoading(true);

  try {
    const reply = await callGemini(hits);
    typingEl.remove();

    // Se a resposta menciona preços E temos hits no catálogo, exibe tabela
    const showTable = hits.length > 0 && /R\$|preço|valor|custa|custam/i.test(reply);
    appendBotMessage(reply, showTable ? hits : []);

    conversation.push({ role: "model", parts: [{ text: reply }] });
    trimHistory();
  } catch (err) {
    typingEl.remove();
    appendMessage("error", friendlyError(err));
  } finally {
    setLoading(false);
    scrollToBottom();
  }
}

// ════════════════════════════════════════════════════════════
//  GEMINI API
// ════════════════════════════════════════════════════════════
async function callGemini(ragHits = []) {
  // Se há hits do RAG, injeta um reforço contextual na última mensagem do usuário
  // sem alterar o histórico permanente — apenas nesta chamada
  let contents = [...conversation];
  if (ragHits.length > 0 && ragHits.length <= 8) {
    const ragContext = buildRagContext(ragHits);
    // Substitui a última mensagem user com contexto extra
    const lastUser = contents[contents.length - 1];
    contents = [
      ...contents.slice(0, -1),
      {
        role: "user",
        parts: [{
          text: lastUser.parts[0].text +
            `\n\n[CONTEXTO DO CATÁLOGO – use para responder com precisão]\n${ragContext}`
        }]
      }
    ];
  }

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.3, topP: 0.9, maxOutputTokens: 1024 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(GEMINI_ENDPOINT(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_DELAYS[attempt];
        updateTypingLabel(`⏳ Limite de requisições — tentando em ${waitMs / 1000}s... (${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }
      throw new Error("rate_limit_final");
    }

    if (!response.ok) {
      const status = response.status;
      if (status === 400) throw new Error("bad_request");
      if (status === 401 || status === 403) throw new Error("invalid_key");
      if (status >= 500) throw new Error("server_error");
      throw new Error(`HTTP ${status}`);
    }

    const data      = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error("no_candidate");
    if (candidate.finishReason === "SAFETY") throw new Error("safety_block");

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error("empty_response");
    return text;
  }
}

/** Formata os hits do RAG como texto para injeção na mensagem */
function buildRagContext(hits) {
  return hits.map((s) =>
    `• ${s.nome} — R$ ${s.preco.toFixed(2).replace(".", ",")}: ${s.descricao}`
  ).join("\n");
}

/** Testa se uma chave de API é válida */
async function testApiKey(key) {
  const resp = await fetch(GEMINI_ENDPOINT(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Olá" }] }],
      generationConfig: { maxOutputTokens: 10 },
    }),
  });
  if (resp.ok)  return { valid: true, model: GEMINI_MODEL };
  const status = resp.status;
  if (status === 400) return { valid: false, message: "Chave inválida ou mal formatada." };
  if (status === 401 || status === 403) return { valid: false, message: "Chave sem permissão. Verifique no Google AI Studio." };
  if (status === 429) return { valid: true, model: GEMINI_MODEL + " (limite temporário — chave válida)" };
  return { valid: false, message: `Erro inesperado (HTTP ${status}).` };
}

// ════════════════════════════════════════════════════════════
//  UI – Mensagens
// ════════════════════════════════════════════════════════════
function appendMessage(type, text) {
  const isUser  = type === "user";
  const isError = type === "error";

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isUser ? "user-message" : "bot-message"} ${isError ? "error-bubble" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${isUser ? "user-avatar" : "bot-avatar"}`;
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = isUser ? "👤" : isError ? "⚠️" : "🐾";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = renderMarkdown(text);

  const time = document.createElement("time");
  time.className = "msg-time";
  time.textContent = formatTime(new Date());
  bubble.appendChild(time);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/**
 * Mensagem do bot com tabela de serviços embutida (quando aplicável).
 * hits = array de serviços encontrados no RAG.
 */
function appendBotMessage(text, hits = []) {
  const wrapper = document.createElement("div");
  wrapper.className = "message bot-message";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "🐾";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = renderMarkdown(text);

  // Tabela de serviços se tiver hits relevantes
  if (hits.length > 0) {
    bubble.appendChild(buildServicesTable(hits));
    // Tag de fonte RAG
    const src = document.createElement("div");
    src.className = "rag-source-tag";
    src.innerHTML = `📂 Fonte: <strong>clinica.json</strong> — dados em tempo real`;
    bubble.appendChild(src);
  }

  const time = document.createElement("time");
  time.className = "msg-time";
  time.textContent = formatTime(new Date());
  bubble.appendChild(time);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

/** Cria a tabela HTML de serviços */
function buildServicesTable(servicos) {
  const wrap  = document.createElement("div");
  wrap.className = "services-table-wrap";

  const table = document.createElement("table");
  table.className = "services-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>Serviço</th>
        <th>Categoria</th>
        <th>Preço</th>
      </tr>
    </thead>`;

  const tbody = document.createElement("tbody");
  for (const s of servicos) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escHtml(s.nome)}</td>
      <td><span class="cat-tag">${escHtml(s.categoria || "—")}</span></td>
      <td class="price-cell">R$ ${s.preco.toFixed(2).replace(".", ",")}</td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appendTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "message bot-message";
  wrapper.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "🐾";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<p class="typing-label">Assistente está digitando...</p>
    <div class="typing-indicator" aria-label="Carregando resposta">
      <span></span><span></span><span></span>
    </div>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

// ════════════════════════════════════════════════════════════
//  CONFIG PAGE
// ════════════════════════════════════════════════════════════
function switchView(view) {
  currentView = view;
  if (view === "config") {
    chatView.classList.add("hidden");
    configView.classList.remove("hidden");
    openConfigBtn.classList.add("active");
    openConfigBtn.querySelector("span").textContent = "Fechar";
    renderConfigStatus();
    newApiKeyInput.focus();
  } else {
    configView.classList.add("hidden");
    chatView.classList.remove("hidden");
    openConfigBtn.classList.remove("active");
    openConfigBtn.querySelector("span").textContent = "API";
    userInput.focus();
  }
}

function renderConfigStatus() {
  resetValidationFeedback();
  newApiKeyInput.value = "";
  newApiKeyInput.className = "field-input";
  if (apiKey) {
    configCurrentRow.style.display = "flex";
    configCurrentKey.textContent = maskKey(apiKey);
    setConfigStatus("ok", "✅", "Chave configurada", "O assistente está pronto para uso.");
  } else {
    configCurrentRow.style.display = "none";
    setConfigStatus("neutral", "❓", "Nenhuma chave configurada", "Insira uma chave do Google Gemini abaixo para ativar o assistente.");
  }
}

function setConfigStatus(type, icon, title, desc) {
  configStatusBox.className = "config-status-box";
  if (type === "ok")       configStatusBox.classList.add("status-ok");
  if (type === "error")    configStatusBox.classList.add("status-error");
  if (type === "warning")  configStatusBox.classList.add("status-warning");
  if (type === "checking") configStatusBox.classList.add("status-checking");
  configStatusIcon.textContent  = icon;
  configStatusTitle.textContent = title;
  configStatusDesc.textContent  = desc;
}

function maskKey(key) {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••••••••••" + key.slice(-4);
}

function toggleKeyVisibility() {
  const isPwd = newApiKeyInput.type === "password";
  newApiKeyInput.type = isPwd ? "text" : "password";
  toggleVisibilityBtn.querySelector("svg").innerHTML = isPwd
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
}

async function handleValidateKey() {
  const key = newApiKeyInput.value.trim();
  if (!key) {
    showValidationFeedback("error", "❌", "Cole sua chave no campo antes de testar.");
    newApiKeyInput.className = "field-input input-error";
    newApiKeyInput.focus();
    return;
  }
  validateBtn.disabled = saveNewKeyBtn.disabled = true;
  showValidationFeedback("checking", "⏳", "Testando conexão com a API do Gemini...");
  setConfigStatus("checking", "🔄", "Verificando chave...", "Fazendo requisição de teste ao Google Gemini.");

  try {
    const result = await testApiKey(key);
    if (result.valid) {
      newApiKeyInput.className = "field-input input-ok";
      showValidationFeedback("success", "✅", `Chave válida! Modelo: ${result.model}`);
      setConfigStatus("ok", "✅", "Chave válida e funcional!", "Clique em 'Salvar e usar esta chave' para ativar.");
    } else {
      newApiKeyInput.className = "field-input input-error";
      showValidationFeedback("error", "❌", result.message);
      setConfigStatus("error", "❌", "Chave inválida", result.message);
    }
  } catch {
    newApiKeyInput.className = "field-input input-error";
    showValidationFeedback("error", "🌐", "Não foi possível conectar. Verifique sua internet.");
    setConfigStatus("error", "🌐", "Erro de conexão", "Verifique sua conexão com a internet.");
  } finally {
    validateBtn.disabled = saveNewKeyBtn.disabled = false;
  }
}

function handleSaveNewKey() {
  const key = newApiKeyInput.value.trim();
  if (!key) { showValidationFeedback("error", "❌", "Cole sua chave antes de salvar."); return; }
  apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  setHeaderStatus("online", "Assistente Online");
  renderConfigStatus();
  showValidationFeedback("success", "✅", "Chave salva! O assistente está pronto.");
  setTimeout(() => switchView("chat"), 1200);
}

function handleRemoveKey() {
  if (!confirm("Remover a chave de API? O assistente ficará desativado.")) return;
  apiKey = "";
  localStorage.removeItem(STORAGE_KEY);
  setHeaderStatus("offline", "Sem chave API");
  renderConfigStatus();
}

function showValidationFeedback(type, icon, msg) {
  validationFeedback.className = `validation-feedback ${type}`;
  validationFeedback.classList.remove("hidden");
  validationIcon.textContent = icon + " ";
  validationMsg.textContent  = msg;
}

function resetValidationFeedback() {
  validationFeedback.classList.add("hidden");
  newApiKeyInput.className = "field-input";
}

// ════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════
function setHeaderStatus(state, label) {
  statusDot.className  = `status-dot ${state}`;
  statusText.textContent = label;
}

function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = userInput.disabled = state;
  if (!state) userInput.focus();
}

function scrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

function updateCharCount() {
  const len = userInput.value.length;
  charCount.textContent = `${len} / 1000`;
  charCount.className = "char-count" + (len > 900 ? " danger" : len > 750 ? " warning" : "");
}

function shakeInput() {
  userInput.style.borderColor = "var(--danger)";
  userInput.focus();
  setTimeout(() => (userInput.style.borderColor = ""), 1000);
}

function updateTypingLabel(text) {
  const label = document.querySelector("#typingIndicator .typing-label");
  if (label) label.textContent = text;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function trimHistory() {
  if (conversation.length > MAX_HISTORY)
    conversation = conversation.slice(conversation.length - MAX_HISTORY);
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^[\-\*] (.+)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/^\d+\. (.+)/gm, "<li>$1</li>")
    .split(/\n\n+/)
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      if (t.startsWith("<ul>") || t.startsWith("<li>")) return t;
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function friendlyError(err) {
  const msg = err.message || "";
  if (msg === "invalid_key" || msg.includes("API_KEY"))
    return "🔑 Chave de API inválida. Clique em <strong>API</strong> no topo para trocar a chave.";
  if (msg === "rate_limit_final")
    return "⏳ Limite de requisições atingido após várias tentativas. Aguarde 1 minuto e tente novamente.";
  if (msg === "server_error")
    return "🛠️ O servidor do Gemini está instável. Tente novamente em alguns minutos.";
  if (msg === "safety_block")
    return "🚫 Mensagem bloqueada pelos filtros de segurança. Por favor, reformule sua pergunta.";
  if (msg === "no_candidate" || msg === "empty_response")
    return "😕 Não consegui gerar uma resposta. Tente novamente.";
  if (msg === "bad_request")
    return "⚠️ Requisição inválida. Verifique sua chave de API.";
  if (err instanceof TypeError)
    return "🌐 Erro de conexão. Verifique se o servidor local está rodando (<code>npx serve .</code>).";
  return `❌ Erro inesperado: ${msg || "desconhecido"}.`;
}

function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
