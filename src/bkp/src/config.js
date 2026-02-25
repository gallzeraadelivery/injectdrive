// src/config.js
module.exports = {
  TCC_URL: 'https://google.com',
  DEFAULT_IMAGE_PATH: 'C:\\veriff-electra-com menu\\minha-foto.jpg',
  BASE_W: 1080,
  BASE_H: 2340,
  FPS: 30,
  REQUIRE_PROXY_LOGIN: true,
  PROXY_BYPASS: '<-loopback>',
  ANDROID_EMULATE_VIEWPORT: true,  // ← OBRIGATÓRIO
  ANDROID_VIEWPORT_HOSTS: [
    'veriff.me', 'veriff.com', 'magic.veriff.me',
    'uber.com', 'bonjour.uber.com',
    'onfido.com', 'iproov.me', 'iproov.com'
  ]
};