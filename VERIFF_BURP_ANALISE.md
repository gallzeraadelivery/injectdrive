# Análise minuciosa Veriff + Burp — Foto de perfil, CNH e aprovação automática

Este documento reúne a documentação oficial da Veriff e os campos que aparecem nas APIs (incluindo fluxos tipo Uber/getStepByUuid) para **interceptar e alterar no Burp** e aumentar as chances de aprovação da **foto de perfil** e da **carteira de motorista (drive license)**, ou forçar aprovação automática.

---

## Foco: aprovar foto de perfil e CNH (drive license)

**Objetivo:** que a **foto de perfil** e a **CNH (drive license)** sejam aprovadas (status `approved`, code 9001), usando o Burp para interceptar e alterar o que for necessário.

### O que o Burp faz (extensão Selfie Replacer)

| Alvo | Ação | Para que serve |
|------|------|----------------|
| **Upload da foto de perfil / selfie** | Substitui o corpo da requisição pela imagem em `burp-replacement-path.txt` | O servidor recebe a foto que você escolheu (Toolbox ou arquivo). |
| **Upload do documento (CNH)** | Idem: substitui por arquivo de imagem/PDF configurado | O servidor recebe a CNH que você enviou. |
| **Resposta getStepByUuid (config do passo)** | Remove `verifyWebviewUrl`, ajusta liveness/doc (permite galeria, desliga liveness) | O app não redireciona ao Veriff e aceita fluxo com menos checagem. |
| **Resposta de decisão Veriff** (qualquer URL Veriff com status) | Força `status: "approved"`, `code: 9001`, limpa `reason`/`reasonCode` | Tanto a verificação da **foto de perfil** quanto da **CNH** viram aprovadas na resposta. |

### Fluxo recomendado (Burp + app)

1. **Burp** em 127.0.0.1:8080, extensão **Selfie Replacer** carregada.
2. **App** com proxy 127.0.0.1:8080.
3. **Foto de perfil:** escolher a imagem na Toolbox (ou no Burp) → app grava em `burp-replacement-path.txt` → extensão substitui o upload; respostas de decisão Veriff são forçadas para `approved`.
4. **CNH (drive license):** mesmo fluxo: usar a imagem/PDF da CNH como “replacement” no upload do documento; respostas Veriff da etapa de documento forçadas para `approved`.

Assim o **foco continua em aprovar foto de perfil e drive license**: requisições com sua mídia, respostas de decisão com status aprovado.

---

## 1. Documentação oficial Veriff (resumo)

- **Decisão da sessão**: `approved` | `declined` | `resubmission_requested` | `expired` | `abandoned` | `review`
- **Endpoint de decisão**: `GET /v1/sessions/{sessionId}/decision`
- **Aprovação**: `verification.status === "approved"` e `verification.code === 9001`; `reason` e `reasonCode` devem ser `null`.
- **Códigos de status**: 7001 started, 7002 submitted, **9001 approved**, 9102 declined, 9103 resubmission_requested, 9104 expired/abandoned, 9121 review.
- **Reason codes**: dezenas de códigos para declined (101–586+) e resubmission_requested (201–217, 602–695+) — ver [Granular reason codes](https://devdocs.veriff.com/docs/granular-reason-codes) e [Decision codes table](https://devdocs.veriff.com/docs/verification-session-decision-codes-table).

Toda resposta que o front recebe com **status de verificação** (seja da API oficial Veriff ou de um proxy/backend do parceiro) pode ser alterada no Burp para `approved` + `9001` e `reason`/`reasonCode` limpos.

---

## 2. Onde a Veriff aparece no tráfego (interceptar no Burp)

| Tipo | Exemplo / Padrão | O que fazer no Burp |
|------|-------------------|----------------------|
| **API oficial Veriff** | `veriff.me`, `magic.veriff.me`, `/v1/sessions/`, `/decision`, `/verifications/`, `/api/v2/verifications/` | **Resposta**: forçar `status: "approved"`, `code: 9001`, `verification.status`, `verification.code`, `verification.reason: null`, `verification.reasonCode: null`. |
| **API do parceiro (ex. Uber)** | `getStepByUuid`, `bonjour.uber.com` (ou outro host) retornando JSON com configuração do passo | **Resposta**: alterar campos de **configuração do fluxo** (ver seção 3) e remover `verifyWebviewUrl` para evitar redirect ao Veriff. |

Ou seja:  
- **Respostas de decisão/verificação** → alterar para approved.  
- **Respostas de “config do passo”** (getStepByUuid etc.) → alterar flags e remover URL do webview.

---

## 3. Campos de configuração do fluxo (respostas tipo getStepByUuid)

Estes campos aparecem em respostas JSON que definem **como** o app mostra o fluxo (upload manual, câmera, liveness, documento, etc.). Alterá-los **na resposta** (via Burp) pode reduzir exigências e aumentar a chance de aprovação (ex.: permitir galeria, desligar liveness obrigatório).

| Campo | Valores típicos | Efeito ao alterar (objetivo) |
|-------|------------------|------------------------------|
| **manual_image_upload_required** | `true` / `false` | `true` → permite enviar imagem já pronta (galeria/arquivo) em vez de só câmera. Útil para injetar foto de perfil/CNH. |
| **digital_document_upload** | `true` / `false` | `true` → permite upload digital do documento (ex.: foto da CNH). |
| **backside_not_required** | `true` / `false` | `true` → verso do documento não obrigatório (menos passos, menos chance de resubmission). |
| **barcode_picture_web** | `true` / `false` | `false` → não exige foto do código de barras (reduz passo e validação). |
| **barcode_picture** | `true` / `false` | `false` → idem. |
| **pdf417_barcode_enabled_web** | `true` / `false` | `false` → desativa exigência de PDF417 na web. |
| **do_2024_h2_identity_document_active_liveness** | `parameterKey` + `parameterValue: "true"` ou `"false"` | `parameterValue: "false"` → desativa liveness ativo para documento de identidade (menos checagem em tempo real). |
| **shouldRestrictGalleryUpload** | `true` / `false` | `false` → não restringe upload pela galeria (permite escolher arquivo). |
| **isLiveVerificationEnabled** | `true` / `false` | `false` → desativa verificação “ao vivo” (liveness), aumentando chance de aceitar a mídia que você injeta. |
| **verifyWebviewUrl** | URL string (ex. `https://magic.veriff.me/v/...`) | **Remover o campo inteiro** → evita que o app abra o webview do Veriff (fluxo fica no app/parceiro). |

**Objetivo geral**: na **resposta** dessas APIs (ex.: getStepByUuid), no Burp:

- Colocar: `manual_image_upload_required: true`, `digital_document_upload: true`, `backside_not_required: true`.
- Colocar: `barcode_picture_web: false`, `barcode_picture: false`, `pdf417_barcode_enabled_web: false`.
- Garantir: `do_2024_h2_identity_document_active_liveness` → `parameterValue: "false"`, `shouldRestrictGalleryUpload: false`, `isLiveVerificationEnabled: false`.
- **Apagar** qualquer linha com `verifyWebviewUrl`.

Assim você “diminui a análise” do Veriff (menos liveness, menos códigos de barras, mais upload manual) e mantém o fluxo no app, usando o Burp para interceptar e alterar.

---

## 4. Respostas de decisão Veriff (aprovar automaticamente)

Qualquer resposta que contenha **decisão de verificação** (status da sessão) deve ser tratada assim no Burp:

### 4.1 Estrutura esperada para “aprovado”

```json
{
  "status": "success",
  "verification": {
    "id": "...",
    "attemptId": "...",
    "status": "approved",
    "code": 9001,
    "reason": null,
    "reasonCode": null,
    "decisionTime": "...",
    "acceptanceTime": "...",
    "submissionTime": "..."
  }
}
```

Algumas APIs retornam `status` e `code` também no **objeto raiz**. Nesse caso, no Burp:

- **Raiz**: `status: "approved"` (ou `"success"` onde for status da requisição), `code: 9001` se existir.
- **Objeto `verification`**: `status: "approved"`, `code: 9001`, `reason: null`, `reasonCode: null`.

### 4.2 URLs / padrões a interceptar (resposta)

- `veriff.me`, `magic.veriff.me`
- `/v1/sessions/`, `/decision`
- `/api/v2/verifications/` (exceto apenas listagem de imagens se não tiver status)
- `/verifications/` em qualquer host que devolva JSON com `status` ou `verification.status`

Regra prática: se o corpo da resposta tiver `"status"` e/ou `"verification"` e não for `approved`/9001, alterar para approved e limpar reason/reasonCode.

---

## 5. Estratégia no Burp (resumo)

| Alvo | Onde | Ação no Burp |
|------|------|----------------|
| **Config do passo (getStepByUuid etc.)** | Resposta | Ajustar os 9 campos acima e **remover** `verifyWebviewUrl` (já feito pela extensão Selfie Replacer para getStepByUuid). |
| **Decisão Veriff (qualquer URL Veriff com status)** | Resposta | Forçar `status: "approved"`, `code: 9001`, `verification.status`, `verification.code`, `reason: null`, `reasonCode: null`. |
| **Upload de selfie/documento** | Requisição | Substituir corpo (imagem/vídeo) pelo arquivo desejado (já feito pela extensão Selfie Replacer). |

Tudo isso em conjunto: **interceptação normal** no Burp (proxy 127.0.0.1:8080) + extensão que modifica **requisições** (upload) e **respostas** (config do passo + decisão Veriff).

---

## 6. Campos que podem ser true/false ou omitidos (checklist)

Para qualquer JSON de **configuração** que apareça em respostas (ex.: getStepByUuid, configs do parceiro):

- **Exigir menos / permitir mais upload**  
  - `manual_image_upload_required` → `true`  
  - `digital_document_upload` → `true`  
  - `backside_not_required` → `true`  
  - `shouldRestrictGalleryUpload` → `false`

- **Desligar checagens que atrapalham**  
  - `barcode_picture_web` → `false`  
  - `barcode_picture` → `false`  
  - `pdf417_barcode_enabled_web` → `false`  
  - `isLiveVerificationEnabled` → `false`  
  - `do_2024_h2_identity_document_active_liveness` → `parameterValue: "false"`

- **Evitar redirect**  
  - Remover completamente o par `verifyWebviewUrl` (nome e valor).

Para qualquer JSON de **decisão** (Veriff):

- `status` → `"approved"`  
- `code` → `9001`  
- `verification.status` → `"approved"`  
- `verification.code` → `9001`  
- `verification.reason` → `null`  
- `verification.reasonCode` → `null`  

(Se algum desses campos não existir na resposta, pode ser **adicionado** na alteração no Burp para garantir formato aceito pelo app.)

---

## 7. Referências

- [Verification session decisions](https://devdocs.veriff.com/v1/docs/verification-session-decisions)
- [Decision codes table](https://devdocs.veriff.com/docs/verification-session-decision-codes-table)
- [Granular reason codes](https://devdocs.veriff.com/docs/granular-reason-codes)
- [GET /v1/sessions/{id}/decision](https://devdocs.veriff.com/apidocs/v1sessionsiddecision-1)
- Projeto: `BURP_SELFIE_INJECTION.md`, `burp-selfie-replacer.py` (extensão que aplica parte dessas alterações).
