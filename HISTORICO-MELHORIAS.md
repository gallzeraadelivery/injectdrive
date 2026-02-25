# Histórico de melhorias – FakeCam (electron-fakecam-ui)

Documento com tudo que foi feito nas sessões de desenvolvimento.

---

## 1. Perfis isolados com ID e fingerprint

- Cada perfil tem **id** (UUID) e **fingerprint** (preset + resolução).
- Fingerprint inclui: **preset** (android / iphone / desktop), **width**, **height**, **userAgent**.
- Perfis salvos em `profiles.json` na pasta userData do Electron.
- Ao trocar de perfil, o app navega para a URL do perfil e aplica o fingerprint correspondente.

**Arquivos:** `src/main.js`, `src/config.js`, `src/toolbox.html`, `src/preload-toolbox.js`

---

## 2. URL por perfil

- Cada perfil tem campo **url** (site de destino).
- Ao abrir ou trocar de perfil, o app navega para essa URL.
- Na toolbox: seção **“URL do perfil”** com campo para editar, **Salvar** e **Ir agora**.
- URL padrão vem de `TCC_URL` em `config.js` quando não há URL definida.

**Arquivos:** `src/main.js`, `src/toolbox.html`, `src/preload-toolbox.js`

---

## 3. Ajustes na tela de login do proxy e no menu flutuante

- **Login do proxy:** novo layout (gradiente, ícone, título, campos e botões estilizados).
- **Toolbox:** seções com títulos, inputs e sliders estilizados, botões com gradiente, header com ícone.
- Paleta: roxo/índigo (#6366f1, #4f46e5) para destaques; slate para texto e bordas.

**Arquivos:** `src/login.html`, `src/toolbox.html`

---

## 4. Perfis: Novo, Renomear, Excluir e Limpar

- **Limpar storage:** `currentPartition` passou a ser definida em `app.whenReady`, para o botão Limpar funcionar mesmo antes do login no proxy.
- **Novo perfil:** permite nome vazio (usa nome padrão); só cancela se o usuário fechar o diálogo.
- **Renomear:** validação para não aceitar nome vazio; tratamento de erro com feedback.
- **Excluir / Limpar:** tratamento de erro e atualização da UI após a ação.
- **Modais customizados** no lugar de `prompt()` e `confirm()`, para funcionar em janela frameless (toolbox sem barra de título).

**Arquivos:** `src/main.js`, `src/toolbox.html`

---

## 5. Botões de atalho para navegação (links rápidos)

- Nova seção **“Links rápidos”** na toolbox.
- Lista de atalhos definida em **`config.js`** no array **`SHORTCUTS`**: `{ label, url }`.
- Botões são gerados em tempo de execução; ao clicar, abrem a URL na janela principal do perfil.
- Para adicionar/remover/alterar atalhos: editar `SHORTCUTS` em `src/config.js`.
- Exemplos incluídos: Perfil Uber, Verificar bloqueio, Trocar cidade, Remover veículo, Wallet Uber.

**Arquivos:** `src/config.js`, `src/main.js`, `src/preload-toolbox.js`, `src/toolbox.html`

---

## 6. Trocar proxy durante a sessão

- Botão **“Trocar proxy”** na toolbox (seção Proxy).
- Modal com campos: Host, Porta, Usuário, Senha.
- **Aplicar:** aplica o novo proxy e recarrega a janela principal.
- **Remover proxy:** remove o proxy e recarrega.
- **proxy:get** e **proxy:change** no main; ao abrir o modal, host/porta/usuário atuais são preenchidos (senha não, por segurança).
- Atalho: colar **host:port:user:pass** no campo Host preenche os quatro campos.

**Arquivos:** `src/main.js`, `src/preload-toolbox.js`, `src/toolbox.html`

---

## 7. Tratamento de erro ao aplicar proxy

- Se a conexão com o proxy falhar (ex.: host/porta errados), o app não quebra.
- Mensagens amigáveis para `ERR_PROXY_CONNECTION_FAILED` e erros de túnel/conexão recusada.
- Janela de login do proxy permanece aberta para corrigir ou clicar em Pular.
- Em caso de falha no `loadURL`, a janela principal criada é destruída para não ficar em estado inválido.

**Arquivos:** `src/main.js`, `src/login.html`

---

## 8. Suporte a proxy local (Burp Suite, etc.)

- Ao usar proxy em **127.0.0.1** ou **localhost**, o app aceita os certificados SSL do proxy (ex.: Burp).
- Evita **ERR_CERT_AUTHORITY_INVALID** em interceptação HTTPS.
- Opção em `config.js`: **`IGNORE_SSL_FOR_LOCAL_PROXY: true`** (pode ser `false` para desativar).
- A regra vale só para proxy local; proxies remotos continuam com verificação normal.

**Arquivos:** `src/main.js`, `src/config.js`

---

## Estrutura atual do projeto

```
fakecam2025/
├── package.json
├── abrirnavegador.bat
├── HISTORICO-MELHORIAS.md   ← este arquivo
└── src/
    ├── main.js              (processo principal: janelas, IPC, proxy, perfis)
    ├── config.js            (TCC_URL, SHORTCUTS, IGNORE_SSL_FOR_LOCAL_PROXY, etc.)
    ├── login.html           (tela de proxy – estilo atual)
    ├── toolbox.html         (menu flutuante – perfis, URL, fingerprint, mídia, atalhos, proxy)
    ├── preload-main.js      (injeção fakecam + IPC)
    ├── preload-toolbox.js   (API fakecam + perfis + proxy + shortcuts)
    ├── preload-login.js     (API proxy apply/skip)
    ├── test-cam.html        (página de teste da câmera)
    └── cam-test.html
```

---

## Como rodar

```bash
npm start
```

Ou usar `abrirnavegador.bat` (abre na pasta do projeto e executa `npm start`).

---

*Última atualização: documento criado para registrar todas as melhorias feitas no projeto.*
