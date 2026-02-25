# Correção: Vídeo não funcionava no Upload

## Problema Identificado

Quando você selecionava **vídeo** no Toolbox e tentava fazer upload:
- ❌ Dava erro de upload
- ❌ O Veriff não conseguia processar
- ❌ O sistema estava tentando enviar o vídeo inteiro em vez de capturar um frame

## Correções Implementadas

### 1. **Garantia de que vídeo está pronto antes de capturar**
- ✅ Verifica `readyState >= 2` (metadata carregada)
- ✅ Verifica `videoWidth > 0` e `videoHeight > 0` (dimensões válidas)
- ✅ Garante que vídeo está reproduzindo (`play()`)
- ✅ Aguarda frame estável antes de capturar (150ms)

### 2. **Verificação de conteúdo no canvas**
- ✅ Verifica se o canvas tem conteúdo válido antes de criar blob
- ✅ Se canvas estiver vazio, aguarda mais tempo e tenta novamente
- ✅ Logs no console para debug (`[Liveness]`)

### 3. **Melhorias no desenho do vídeo**
- ✅ Garante que vídeo está sendo desenhado no canvas antes de capturar
- ✅ Tratamento de erros se vídeo não estiver pronto
- ✅ Fallback se desenho falhar

### 4. **Timestamp e metadata**
- ✅ Timestamp muito recente (parece tirada agora)
- ✅ Nome de arquivo realista (`IMG_20260216_143025.jpg`)
- ✅ Propriedades `size` e `lastModifiedDate` configuradas

---

## Como Funciona Agora

### Quando você usa VÍDEO:

1. **Você seleciona vídeo no Toolbox**
   - Vídeo é carregado e começa a reproduzir em loop

2. **Vídeo é desenhado no canvas**
   - Canvas desenha frames do vídeo continuamente
   - Garante que vídeo está reproduzindo

3. **Quando Veriff pede foto:**
   - App verifica se vídeo está pronto (`readyState >= 2`, dimensões válidas)
   - Aguarda frame estável (150ms)
   - **Captura um FRAME do vídeo** do canvas
   - Aplica melhorias de liveness (micro-movimentos, brilho, ruído)
   - Converte para **IMAGEM JPEG**
   - Envia como se fosse foto tirada agora

**Resultado**: Veriff sempre recebe uma **IMAGEM JPEG**, não vídeo!

---

## O que você precisa fazer

### Passo 1: Configure o vídeo
1. No Toolbox, clique em **"🎬 Vídeo"**
2. Selecione um vídeo (MP4 recomendado)
3. Aguarde alguns segundos para o vídeo carregar

### Passo 2: Teste no Veriff
1. Configure proxy: **127.0.0.1:8080**
2. Vá para o Veriff
3. **Aguarde alguns segundos** após carregar a página (deixa vídeo "aquecer")
4. Quando pedir para tirar foto, clique normalmente

### Passo 3: Verifique o console
- Abra o console (F12)
- Você deve ver: `[Liveness] Frame do vídeo capturado como imagem`
- Se aparecer `[Liveness] Aguardando vídeo...`, o vídeo ainda está carregando

---

## Troubleshooting

### Erro: "Vídeo não está pronto"

**Sintoma**: Console mostra `[Liveness] Aguardando vídeo carregar metadata...`

**Solução**:
1. Aguarde mais tempo após selecionar o vídeo
2. Verifique se o vídeo está em formato compatível (MP4)
3. Tente usar uma **imagem** em vez de vídeo

### Erro: "Canvas vazio"

**Sintoma**: Console mostra `[Liveness] Canvas parece vazio`

**Solução**:
1. Aguarde mais tempo antes de tirar foto
2. Verifique se o vídeo está reproduzindo (deve estar em loop)
3. Tente recarregar a página

### Erro: "Blob vazio"

**Sintoma**: Console mostra `[Liveness] Blob vazio`

**Solução**:
1. Verifique se o vídeo tem dimensões válidas
2. Tente usar vídeo menor ou com resolução menor
3. Use imagem em vez de vídeo

---

## Dicas

✅ **Use vídeo curto** (2-5 segundos) - mais fácil de carregar  
✅ **Aguarde alguns segundos** após selecionar vídeo antes de tirar foto  
✅ **Aguarde alguns segundos** após carregar página do Veriff  
✅ **Verifique o console** (F12) para ver o que está acontecendo  
✅ **Se vídeo não funcionar**, use imagem - as melhorias de liveness funcionam em ambos  

---

## Resumo

✅ Vídeo agora **captura frame como imagem** (não envia vídeo inteiro)  
✅ Verifica se vídeo está pronto antes de capturar  
✅ Aguarda frame estável  
✅ Verifica se canvas tem conteúdo válido  
✅ Logs no console para debug  

**O Veriff sempre recebe uma IMAGEM JPEG, mesmo quando você usa vídeo!** 🎯
