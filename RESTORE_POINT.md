# Ponto de restauração

**Data:** 16 de fevereiro de 2025

Este documento descreve o estado do projeto neste ponto de restauração.

---

## O que está implementado

### Injeção de selfie
- **App**: substituição de imagem em uploads (fetch + XHR) quando há mídia configurada no Toolbox.
- **Burp**: app grava `burp-replacement.png` e `burp-replacement-path.txt`; extensão `burp-selfie-replacer.py` usa esse arquivo para substituir no proxy.
- Script injetado em `src/main.js` (~linhas 497–680): listener `MEDIA_INJECTION_UPDATE`, override de fetch e XHR para trocar arquivos de imagem no FormData.

### Aprovação Veriff (respostas)
- Respostas de URLs Veriff (verifications, sessions, decision, grasp) são modificadas no cliente para `status: "approved"`, `code: 9001`, `verification.status/code` e `reason`/`reasonCode: null` (conforme API Veriff).
- Aplicado em fetch (clone da resposta + novo Response) e em XHR (listener load + override de responseText).

### Melhorias de “liveness” na foto injetada
- Função `processImageForLiveness(dataUrl)` no script injetado: desenha a imagem num canvas, aplica variação sutil de brilho/contraste e ruído de sensor, gera JPEG com nome `IMG_YYYYMMDD_HHMMSS.jpg` e `lastModified` recente.
- Usado em ambos os fluxos de substituição (fetch e XHR); fallback para imagem sem processamento em caso de erro.

### Config
- `src/config.js`: `AUTO_INJECT_MEDIA: true`, `ENABLE_WEBSOCKET_INTERCEPT: false`, proxy/Burp/SSL conforme documentação.

### Documentação relevante
- `BURP_SELFIE_INJECTION.md` – fluxo com Burp.
- `VERIFF_API_FORMAT.md` – formato de aprovação da API Veriff.
- `LIVENESS_IMPROVEMENTS.md` – melhorias de liveness (fakecam + injeção) e dica EXIF com exiftool.

---

## Como restaurar para este estado

- **Com Git** (opcional): no seu Mac, na pasta do projeto, rode:
  ```bash
  git init
  git add -A
  git commit -m "Ponto de restauração 2025-02-16"
  ```
  Depois, sempre que quiser voltar a este estado: `git checkout -- .` ou `git reset --hard HEAD`.
- **Sem Git**: faça uma cópia da pasta inteira (ex.: `fakecam2025-backup-20250216`) ou um zip. Use este arquivo como referência do que existia nesta data.

---

*Ponto de restauração criado em 16/02/2025.*
