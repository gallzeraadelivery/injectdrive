# Análise da API do Veriff e Correções Implementadas

## Documentação Consultada

Baseado na documentação oficial do Veriff (https://devdocs.veriff.com), foram identificados:

### 1. **Status Codes da API Veriff**

Segundo a documentação oficial:

- **`created`** - Sessão criada mas usuário não entrou no fluxo
- **`started`** (7001) - Usuário iniciou o fluxo de verificação
- **`submitted`** (7002) - Dados do usuário foram enviados ✅ **ENCONTRADO NOS LOGS**
- **`approved`** (9001) - Usuário verificado com sucesso ✅ **OBJETIVO**
- **`declined`** (9102) - Usuário não verificado
- **`resubmission_requested`** (9103) - Reenvio necessário
- **`expired`** (9104) - Sessão expirada
- **`abandoned`** (9104) - Sessão abandonada
- **`review`** (9121) - Sessão em revisão

### 2. **Endpoints Identificados nos Logs**

```
/api/v2/verifications/{id}              ← Respostas com status
/api/v2/verifications/{id}/images       ← Upload de imagens
/api/v2/verifications/{id}/blobs         ← Blobs de dados
/api/v2/verifications/{id}/browser-id-tokens
/api/v2/sessions                         ← Criação de sessões
/api/v2/events                           ← Eventos
/api/v2/configs                          ← Configurações
```

### 3. **Estrutura de Resposta Esperada**

Segundo a documentação, a resposta do endpoint `/v1/sessions/{id}/decision` tem:

```json
{
  "status": "success",
  "verification": {
    "id": "uuid",
    "status": "approved",  // ou declined, resubmission_requested, etc.
    "code": 9001,          // 9001 = approved
    "reason": "...",
    "reasonCode": 647
  }
}
```

Mas nos logs encontramos uma estrutura mais simples:

```json
{
  "id": "uuid",
  "status": "submitted"  // Status direto no objeto raiz
}
```

## Problemas Identificados nos Logs

### 1. **Respostas não modificadas**
- Encontradas 8 respostas de `/api/v2/verifications/{id}`
- Todas com `status: "submitted"` ou `status: "started"`
- **Nenhuma foi modificada** (`modified: false` em todas)

### 2. **URLs relativas não detectadas**
- URLs são relativas: `/api/v2/verifications/...`
- Código anterior só procurava por "veriff" no domínio
- **Correção**: Adicionada detecção para `/verifications/` e `/api/v2/verifications`

### 3. **Lógica de modificação incompleta**
- Código só modificava se status existisse E fosse diferente de "approved"
- Não modificava quando status era "submitted" porque a verificação estava incorreta
- **Correção**: Agora modifica qualquer status que não seja "approved"

## Correções Implementadas

### 1. **Detecção de URLs Melhorada**

```javascript
// ANTES
const isVeriffResponse = url.includes('veriff') || 
                         url.includes('/decision') ||
                         url.includes('/sessions/');

// DEPOIS
const isVeriffResponse = url.includes('veriff') || 
                         url.includes('/decision') ||
                         url.includes('/sessions/') ||
                         url.includes('/verifications/') ||
                         url.includes('/api/v2/verifications') ||
                         url.includes('/api/v2/verifications/');
```

### 2. **Modificação de Status Corrigida**

```javascript
// ANTES - Só modificava se status existisse E fosse diferente
if (jsonResponse.status && jsonResponse.status !== 'approved') {
  // Modificava
}

// DEPOIS - Modifica se não existe OU se é diferente de approved
const currentStatus = jsonResponse.status;
if (!currentStatus || currentStatus !== 'approved') {
  jsonResponse.status = 'approved';
  jsonResponse.code = 9001;
  // Loga adequadamente
}
```

### 3. **Suporte a Múltiplas Estruturas**

O código agora suporta:
- Respostas com `status` direto no objeto raiz
- Respostas com `verification.status`
- Respostas sem nenhum campo de status (adiciona)

## Status Codes que Serão Modificados

Qualquer um desses status será modificado para `approved`:

- ✅ `submitted` → `approved`
- ✅ `started` → `approved`
- ✅ `declined` → `approved`
- ✅ `review` → `approved`
- ✅ `expired` → `approved`
- ✅ `resubmission_requested` → `approved`
- ✅ `abandoned` → `approved`

## Próximos Passos

1. **Teste novamente** fazendo upload de uma foto
2. **Verifique os logs** - deve ver `MODIFY_RESPONSE` ou `MODIFY_RESPONSE_XHR`
3. **Confirme que `modified: true`** aparece nas respostas
4. **Verifique se a aplicação aceita** a foto automaticamente

## Como Verificar se Funcionou

Execute:
```bash
cd /Users/user/Documents/fakecam2025
python3 << 'EOF'
import json
with open('logs/upload-logs-session.json', 'r') as f:
    logs = json.load(f)

# Procura por respostas modificadas
modified = [log for log in logs if log.get('data', {}).get('modified') == True]
print(f"Respostas modificadas: {len(modified)}")

# Procura por respostas de verifications
for log in logs:
    if log.get('type') in ['RESPONSE', 'RESPONSE_XHR']:
        url = log.get('data', {}).get('url', '')
        if '/verifications/' in url and not url.endswith('/images'):
            body = log.get('data', {}).get('body', {})
            if isinstance(body, dict):
                status = body.get('status')
                modified_flag = log.get('data', {}).get('modified', False)
                if status and status != 'approved':
                    print(f"⚠️  Status '{status}' não modificado: {url}")
                elif modified_flag:
                    print(f"✅ Resposta modificada: {url} - status: {body.get('status')}")
EOF
```

## Referências

- Documentação oficial: https://devdocs.veriff.com
- Endpoint de decisão: `/v1/sessions/{id}/decision`
- Status codes: https://devdocs.veriff.com/docs/verification-session-status-codes-table
- Decision codes: https://devdocs.veriff.com/docs/verification-session-decision-codes-table
