// src/config.js
module.exports = {
  TCC_URL: 'https://google.com',
  DEFAULT_IMAGE_PATH: 'C:\\veriff-electra-com menu\\minha-foto.jpg',
  BASE_W: 1080,
  BASE_H: 2340,
  FPS: 30,
  REQUIRE_PROXY_LOGIN: true,
  // Bypass: loopback + Veriff (TURN/WebRTC). Sem isso, turn*.falcon-*.veriff.me falha DNS (-105) com proxy.
  PROXY_BYPASS: '<-loopback>,.veriff.me,.veriff.com,*veriff.me,*veriff.com',
  // Quando o proxy é local (127.0.0.1, localhost), aceita certificados SSL do proxy (ex.: Burp Suite).
  IGNORE_SSL_FOR_LOCAL_PROXY: true,
  // Aceita certificados SSL de QUALQUER proxy configurado (Burp, mitmproxy, etc). Use para interceptação.
  ACCEPT_PROXY_SSL_CERTIFICATES: true,
  // Se true, ignora TODOS os erros de certificado (Burp, proxy, etc). Necessário quando ERR_FAILED persiste.
  IGNORE_SSL_CERTIFICATES: true,
  // Caminho para o certificado CA do Burp (PEM ou DER). Exporte em Burp: Proxy > Options > Import / export CA certificate > Export > Certificate in DER format, depois converta para PEM se necessário. Deixe vazio para não usar.
  BURP_CA_PATH: '',  // ex: 'C:\\Users\\vc\\burp-ca.pem' ou '/Users/vc/burp-ca.pem'
  // Injeção funciona em DUPLO: app (fetch/XHR override) + Burp (extensão burp-selfie-replacer.py).
  // App grava imagem em burp-replacement.* + burp-replacement-path.txt para o Burp usar.
  AUTO_INJECT_MEDIA: true,  // true = app substitui em fetch/XHR E Burp também substitui (dupla proteção)
  // Modo de interceptação:
  // 'auto' = detecta automaticamente qualquer POST/PUT com vídeo/imagem (recomendado)
  // 'urls' = só intercepta URLs específicas listadas em AUTO_INJECT_URLS
  AUTO_INJECT_MODE: 'auto',  // 'auto' ou 'urls'
  AUTO_INJECT_URLS: [  // URLs específicas (só usado se AUTO_INJECT_MODE === 'urls')
    '/upload', '/selfie', '/video', '/photo', '/veriff', '/onfido', '/iproov'
  ],
  // Interceptação de WebSocket (modificar respostas para approved). DESLIGADA para não quebrar a injeção de imagem.
  ENABLE_WEBSOCKET_INTERCEPT: false,
  ANDROID_EMULATE_VIEWPORT: true,  // ← OBRIGATÓRIO
  ANDROID_VIEWPORT_HOSTS: [
    'veriff.me', 'veriff.com', 'magic.veriff.me',
    'uber.com', 'bonjour.uber.com',
    'onfido.com', 'iproov.me', 'iproov.com'
  ],

  // Botões de atalho para navegação (label + url). Edite aqui para adicionar/remover.
  SHORTCUTS: [
    { label: 'Perfil Uber', url: 'https://bonjour.uber.com/profile?entrypoint=postonboarding&_csid=xcTL8YynWgqgK78M8iA_HQ&state=L4V2hB45qFbSjc67b-q-qXZAOEdyadIQj5GJL9QOT1k%3D&effect=' },
    { label: 'Verificar bloqueio', url: 'https://bonjour.uber.com/hub?_csid=h-t7U3Pu4UMAL7Xh45FWUw&effect=&marketing_vistor_id=fbe46567-77c1-4b9b-ad65-b00c1a60a2bd&state=-MtmlwdwJZsY9bKtgOdwShoEnop8iurAJJuG9EmhN-4%3D&uclick_id=4c0eb8fa-4387-48af-b654-e1dbd7c71946&wstate=YpGJm_LYpQGU00XW9mVbEMYMWTuyv6HObK5FwD1Lc2U%3D' },
    { label: 'Trocar cidade da conta', url: 'https://help.uber.com/pt-BR/driving-and-delivering/article/quero-dirigir-ou-fazer-entregas-pelo-app-da-uber-em-outra-cidade?nodeId=7b58d071-3b65-41e3-9d01-1b3b639a9671&utm_source=chatgpt.com' },
    { label: 'Remover veículo', url: 'https://help.uber.com/driving-and-delivering/article/remove-my-vehicle?nodeId=5f13c8bc-e773-4e80-9d95-f551ac48ea00' },
    { label: 'Wallet Uber', url: 'https://wallet.uber.com/' },
  ],
};