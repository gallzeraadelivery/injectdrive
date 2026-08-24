# Modificação Automática de Payloads para Aprovação

Este documento explica o sistema de interceptação e modificação automática de payloads de upload de imagem para facilitar a aprovação.

## Funcionalidades

### 1. **Logging Detalhado**
- Todas as requisições POST/PUT são logadas automaticamente
- Logs incluem: URL, método, tipo de body, payload completo, headers
- Respostas também são logadas (status, body)
- Logs são armazenados em memória e podem ser acessados via console

### 2. **Modificação Automática de Payloads**
O sistema modifica automaticamente campos relacionados a liveness e verificação:

#### Campos que são modificados para `true` (desabilitar verificações):
- `liveness_disable` → `true`
- `skipLiveness` → `true`
- `skip_liveness` → `true`
- `bypassLiveness` → `true`
- `bypass_liveness` → `true`

#### Campos que são modificados para `false` (desabilitar verificações):
- `livenessCheck` → `false`
- `liveness_check` → `false`
- `enableLiveness` → `false`
- `enable_liveness` → `false`
- `requireLiveness` → `false`
- `require_liveness` → `false`
- `livenessRequired` → `false`
- `liveness_required` → `false`

#### Campos adicionados automaticamente (se não existirem):
- `liveness_disable: true` (sempre adicionado)
- `skip_verification: true`
- `skipVerification: true`
- `bypass_checks: true`
- `bypassChecks: true`
- `auto_approve: true`
- `autoApprove: true`
- `manual_review: false`
- `manualReview: false`
- `strict_mode: false`
- `strictMode: false`

### 3. **Substituição de Imagem**
- Substitui automaticamente imagens em uploads pela imagem configurada no Toolbox
- Funciona com `FormData` e JSON (base64)
- Foca apenas em imagens (vídeos são ignorados)

## Como Usar

### 1. Configurar Imagem no Toolbox
1. Abra o Toolbox (menu flutuante)
2. Clique em "🔧 Imagem" na seção "Mídia da câmera"
3. Selecione a imagem que deseja usar para upload

### 2. Ver Logs no Console
Abra o console do navegador (F12) e você verá:

```
[Upload-Intercept] POST https://api.veriff.me/v1/upload
Body Type: JSON
Body Data: { ... }
```

### 3. Ver Todos os Logs
No console, execute:
```javascript
__GET_UPLOAD_LOGS()
```

Ou veja a tabela completa:
```javascript
console.table(__UPLOAD_LOGS)
```

### 4. Verificar Modificações
Quando um payload é modificado, você verá logs como:
```
[Upload-Log] MODIFY_FIELD { field: 'liveness_disable', old: false, new: true, reason: 'Desabilitar liveness' }
[Upload-Log] ADD_FIELD { field: 'liveness_disable', value: true, reason: 'Adicionar para desabilitar liveness' }
[Upload-Log] PAYLOAD_MODIFIED { url: '...', original: {...}, modified: {...} }
```

## Estrutura dos Logs

Cada log contém:
- `timestamp`: Data/hora ISO do evento
- `type`: Tipo do evento (`REQUEST`, `RESPONSE`, `MODIFY_FIELD`, `ADD_FIELD`, `REPLACE_MEDIA`, `ERROR`)
- `data`: Dados específicos do evento

### Tipos de Logs:

1. **REQUEST**: Requisição HTTP interceptada
   ```javascript
   {
     method: 'POST',
     url: 'https://api.veriff.me/v1/upload',
     bodyType: 'JSON',
     body: { ... },
     headers: { ... }
   }
   ```

2. **RESPONSE**: Resposta HTTP recebida
   ```javascript
   {
     url: 'https://api.veriff.me/v1/upload',
     status: 200,
     statusText: 'OK',
     body: { ... }
   }
   ```

3. **MODIFY_FIELD**: Campo modificado no payload
   ```javascript
   {
     field: 'liveness_disable',
     old: false,
     new: true,
     reason: 'Desabilitar liveness'
   }
   ```

4. **ADD_FIELD**: Campo adicionado ao payload
   ```javascript
   {
     field: 'liveness_disable',
     value: true,
     reason: 'Adicionar para desabilitar liveness'
   }
   ```

5. **REPLACE_MEDIA**: Mídia substituída
   ```javascript
   {
     url: 'https://api.veriff.me/v1/upload',
     field: 'image',
     oldFile: 'original.jpg',
     newFile: 'image.jpg'
   }
   ```

6. **ERROR**: Erro ocorrido
   ```javascript
   {
     error: 'Mensagem de erro',
     url: 'https://...'
   }
   ```

## Exemplo de Payload Modificado

### Antes:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "liveness_disable": false,
  "requireLiveness": true
}
```

### Depois:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",  // Substituído pela imagem configurada
  "liveness_disable": true,                        // Modificado para true
  "requireLiveness": false,                         // Modificado para false
  "skip_verification": true,                        // Adicionado
  "auto_approve": true,                             // Adicionado
  "strict_mode": false                              // Adicionado
}
```

## Troubleshooting

### Logs não aparecem?
- Verifique se `AUTO_INJECT_MEDIA` está `true` em `config.js`
- Abra o console do navegador (F12)
- Verifique se há erros no console

### Payload não está sendo modificado?
- Verifique se a requisição é POST ou PUT
- Verifique se o body é JSON válido
- Veja os logs para entender o que está sendo interceptado

### Imagem não está sendo substituída?
- Configure a imagem no Toolbox antes de fazer upload
- Verifique se o campo no payload se chama `image`, `file`, `selfie`, `photo`, `media`, `blob` ou `picture`
- Veja os logs para ver se a interceptação está funcionando

## Adicionar Novos Campos

Para adicionar novos campos que devem ser modificados, edite a função `modifyPayloadForApproval` em `src/main.js`:

```javascript
// Adicione campos que devem ser true
const shouldBeTrue = [
  'liveness_disable',
  'seu_novo_campo'  // ← Adicione aqui
];

// Adicione campos que devem ser false
const shouldBeFalse = [
  'requireLiveness',
  'seu_outro_campo'  // ← Adicione aqui
];

// Adicione campos que devem ser adicionados automaticamente
const approvalFields = {
  'liveness_disable': true,
  'seu_campo': true  // ← Adicione aqui
};
```

## Notas Importantes

- O sistema foca apenas em **imagens**, não vídeos
- Logs são armazenados em memória (máximo 100 logs)
- Modificações são aplicadas automaticamente antes do envio
- Todos os payloads são logados, mesmo que não sejam modificados
- Use os logs para identificar novos campos que precisam ser modificados
