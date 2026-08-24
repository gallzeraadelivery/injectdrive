# Interceptação e Modificação de Respostas do Veriff

Este documento explica como o sistema intercepta e modifica automaticamente as respostas da API do Veriff para forçar aprovação.

## Como Funciona

### 1. **Interceptação de Respostas**

O sistema intercepta todas as respostas HTTP que vêm de URLs do Veriff e modifica automaticamente o status para `approved`.

#### URLs Interceptadas:
- Qualquer URL que contenha `veriff`
- URLs com `/decision` (endpoint de decisão do Veriff)
- URLs com `/sessions/` (sessões do Veriff)

### 2. **Modificação Automática**

Quando uma resposta do Veriff é interceptada, o sistema:

1. **Verifica o status atual:**
   - Se `status !== 'approved'` → modifica para `approved`
   - Se `code !== 9001` → modifica para `9001`

2. **Modifica campos de verificação:**
   - `verification.status` → `approved`
   - `verification.code` → `9001`

3. **Adiciona campos se não existirem:**
   - Adiciona `status: 'approved'` se não existir
   - Adiciona `code: 9001` se não existir
   - Adiciona objeto `verification` com status aprovado se não existir

### 3. **Formatos de Resposta do Veriff**

Segundo a documentação oficial do Veriff:

```json
{
  "status": "approved",  // ou "declined", "resubmission_requested", "expired", "review"
  "code": 9001,          // 9001 = approved, 9102 = declined, etc.
  "verification": {
    "status": "approved",
    "code": 9001,
    // ... outros campos
  }
}
```

**Códigos de Status:**
- `9001` = `approved` (Aprovado) ✅
- `9102` = `declined` (Rejeitado) ❌
- `9103` = `resubmission_requested` (Reenvio necessário) 🔄
- `9104` = `expired` (Expirado) ⏰
- `9121` = `review` (Em revisão) 👀

## Implementação

### Fetch API

```javascript
// Intercepta fetch e modifica resposta
const response = await fetch(url);
if (isVeriffResponse) {
  const json = await response.json();
  json.status = 'approved';
  json.code = 9001;
  return new Response(JSON.stringify(json), { ... });
}
```

### XMLHttpRequest

```javascript
// Intercepta XHR e modifica responseText
xhr.addEventListener('load', function() {
  if (isVeriffResponse) {
    const json = JSON.parse(this.responseText);
    json.status = 'approved';
    json.code = 9001;
    // Sobrescreve responseText
    Object.defineProperty(this, 'responseText', {
      get: () => JSON.stringify(json)
    });
  }
});
```

## Logs

Todas as modificações são logadas:

- `MODIFY_RESPONSE`: Resposta modificada via fetch
- `MODIFY_RESPONSE_XHR`: Resposta modificada via XMLHttpRequest
- `ADD_RESPONSE_FIELD`: Campo adicionado à resposta

Os logs incluem:
- URL da requisição
- Campo modificado
- Valor original
- Valor novo
- Motivo da modificação

## Exemplo de Resposta Modificada

### Antes (Resposta Original do Veriff):
```json
{
  "status": "declined",
  "code": 9102,
  "verification": {
    "status": "declined",
    "code": 9102,
    "reason": "Photo quality too low"
  }
}
```

### Depois (Resposta Modificada):
```json
{
  "status": "approved",
  "code": 9001,
  "verification": {
    "status": "approved",
    "code": 9001,
    "reason": "Photo quality too low"
  }
}
```

## Resultado Esperado

Quando a resposta é modificada para `approved`:

1. **A aplicação (Uber, etc.) recebe status de aprovação**
2. **A mensagem "Obrigado pela foto" aparece**
3. **A foto é aceita no sistema automaticamente**

## Troubleshooting

### Resposta não está sendo modificada?

1. Verifique se a URL contém `veriff`, `/decision` ou `/sessions/`
2. Verifique os logs no console: `[Auto-Inject] Resposta do Veriff modificada`
3. Verifique os logs salvos em `logs/upload-logs-session.json`

### A aplicação ainda mostra erro?

1. Pode ser que a aplicação verifique outros campos além de `status`
2. Pode ser que a aplicação faça cache da resposta
3. Verifique os logs para ver exatamente o que está sendo enviado/recebido

### Como verificar se está funcionando?

1. Abra o console do navegador (F12)
2. Procure por: `[Auto-Inject] Resposta do Veriff modificada`
3. Verifique os logs em `logs/upload-logs-session.json`
4. Veja o campo `modified: true` nos logs de resposta

## Notas Importantes

- ⚠️ A modificação acontece **apenas no lado do cliente** (navegador)
- ⚠️ O servidor do Veriff ainda recebe a resposta original
- ⚠️ A aplicação (Uber) vê a resposta modificada como se viesse do Veriff
- ✅ Isso força a aplicação a aceitar a foto como aprovada

## Próximos Passos

Se a aplicação ainda não aceitar após a modificação:

1. Analise os logs para identificar outros campos que precisam ser modificados
2. Verifique se há outras APIs sendo chamadas além do Veriff
3. Verifique se há validações no lado do cliente que precisam ser contornadas
