# Interceptação de WebSocket

## O que é WebSocket?

WebSocket é um protocolo de comunicação que permite comunicação em tempo real entre o navegador e o servidor. Diferente de HTTP (que é "request-response"), WebSocket mantém uma conexão aberta onde ambos os lados podem enviar mensagens a qualquer momento.

## Por que precisamos interceptar WebSocket?

Algumas aplicações (como o Uber/Veriff) podem usar WebSocket para:
- Receber atualizações de status em tempo real
- Notificar quando uma verificação foi aprovada/rejeitada
- Sincronizar dados entre cliente e servidor

Se o Veriff usar WebSocket para enviar o status da verificação, precisamos interceptar essas mensagens e modificá-las para forçar aprovação.

## Como funciona a interceptação?

1. **Detecção de Conexões WebSocket**: Quando uma conexão WebSocket é criada (`new WebSocket(url)`), verificamos se a URL contém palavras-chave relacionadas ao Veriff (`veriff`, `verification`, `uber` + `verify`).

2. **Interceptação de Mensagens**: Quando o servidor envia uma mensagem através do WebSocket, interceptamos antes que a aplicação processe.

3. **Modificação de Status**: Se a mensagem contém um campo `status` que não é `"approved"`, modificamos para `"approved"` e adicionamos `code: 9001`.

4. **Logging**: Todas as conexões e mensagens WebSocket são logadas para análise.

## Campos Modificados

- `status`: Qualquer valor diferente de `"approved"` → `"approved"`
- `code`: Adicionado/modificado para `9001`
- `verification.status`: Qualquer valor diferente de `"approved"` → `"approved"`
- `verification.code`: Adicionado/modificado para `9001`

## Exemplo de Modificação

**Antes:**
```json
{
  "id": "12345",
  "status": "submitted",
  "verification": {
    "status": "submitted"
  }
}
```

**Depois:**
```json
{
  "id": "12345",
  "status": "approved",
  "code": 9001,
  "verification": {
    "status": "approved",
    "code": 9001
  }
}
```

## Logs

Os logs incluem:
- `WEBSOCKET_CONNECT`: Quando uma conexão WebSocket Veriff é detectada
- `WEBSOCKET_MESSAGE`: Quando uma mensagem é recebida
- `MODIFY_WEBSOCKET_MESSAGE`: Quando uma mensagem é modificada
- `ADD_WEBSOCKET_FIELD`: Quando um campo é adicionado

## Verificação

Para verificar se WebSocket está sendo usado:
1. Abra o DevTools (F12)
2. Vá para a aba "Network"
3. Filtre por "WS" (WebSocket)
4. Procure por conexões relacionadas ao Veriff
5. Verifique as mensagens recebidas

Ou verifique os logs em `logs/upload-logs-session.json` procurando por `WEBSOCKET_*`.

## Troubleshooting

**Problema**: WebSocket não está sendo interceptado
- **Solução**: Verifique se a URL do WebSocket contém palavras-chave do Veriff. Se não contiver, podemos adicionar mais padrões de detecção.

**Problema**: Mensagens não estão sendo modificadas
- **Solução**: Verifique os logs para ver se as mensagens estão sendo recebidas e se o formato JSON está correto.

**Problema**: Aplicação ainda mostra status incorreto
- **Solução**: Pode ser que a aplicação esteja verificando o status no servidor, não apenas no cliente. Nesse caso, precisaríamos interceptar também no servidor (via Burp Suite ou proxy).
