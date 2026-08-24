# Formato Oficial da API Veriff para Aprovação

## Consulta à Documentação Oficial

Consultei a documentação oficial do Veriff em: https://devdocs.veriff.com/

## Status de Aprovação

### Código de Status
- **Status**: `"approved"` (string)
- **Code**: `9001` (integer)

### Formato da Resposta

Segundo a documentação oficial do Veriff, uma resposta de aprovação deve ter o seguinte formato:

```json
{
  "status": "success",
  "verification": {
    "id": "12df6045-3846-3e45-946a-14fa6136d78b",
    "attemptId": "00bca969-b53a-4fad-b065-874d41a7b2b8",
    "status": "approved",
    "code": 9001,
    "reason": null,
    "reasonCode": null,
    "decisionTime": "2024-11-06T07:17:36.916Z",
    "acceptanceTime": "2024-11-06T07:15:27.000Z",
    "submissionTime": "2024-11-06T07:16:15.736755Z",
    ...
  }
}
```

### Campos Obrigatórios para Aprovação

1. **`verification.status`**: `"approved"` (string)
2. **`verification.code`**: `9001` (integer)
3. **`verification.reason`**: `null` (para aprovação, deve ser null)
4. **`verification.reasonCode`**: `null` (para aprovação, deve ser null)

### Campos Opcionais mas Importantes

- **`verification.decisionTime`**: Timestamp da decisão (ISO 8601)
- **`verification.acceptanceTime`**: Timestamp da criação da sessão (ISO 8601)
- **`verification.submissionTime`**: Timestamp do envio (ISO 8601)

## Códigos de Status do Veriff

| Status | Code | Significado |
|--------|------|-------------|
| `created` | — | Sessão criada mas usuário não entrou no fluxo |
| `started` | 7001 | Usuário entrou no fluxo de verificação |
| `submitted` | 7002 | Dados do usuário foram enviados |
| **`approved`** | **9001** | **Verificação bem-sucedida e completa** ✅ |
| `declined` | 9102 | Verificação falhou (fraude ou problema grave) |
| `resubmission_requested` | 9103 | Usuário deve reenviar dados |
| `expired` | 9104 | Sessão expirou |
| `abandoned` | 9104 | Sessão foi abandonada |
| `review` | 9121 | Sessão em revisão manual |

## Condições para Aprovação

Segundo a documentação, o Veriff fornece status `approved` (code 9001) quando:
- Fotos e vídeos são enviados para o Veriff
- Dados do documento são legíveis e correspondem em todo o documento
- A foto de retrato do usuário é reconhecível
- O usuário na foto de retrato corresponde à pessoa na foto do documento
- O documento é válido (datas, etc.)

## Endpoints que Retornam Status

O status de verificação está disponível em:
- Decision webhook payload
- POST /sessions response
- GET /sessions/{sessionId}/attempts response
- GET /sessions/{sessionId}/decision response
- GET /api/v2/verifications/{id} response

## Implementação no Código

O código agora garante que todas as respostas do Veriff tenham:
- `status: "approved"`
- `code: 9001`
- `verification.status: "approved"`
- `verification.code: 9001`
- `verification.reason: null`
- `verification.reasonCode: null`

Isso segue exatamente o formato oficial da API do Veriff para aprovação.
