# Como Usar - Liveness para Veriff

## ✅ Confirmação: Melhorias aplicadas em IMAGEM e VÍDEO

As melhorias de liveness estão aplicadas **tanto para imagem quanto para vídeo**:
- ✅ Micro-movimentos sutis
- ✅ Variações de brilho/contraste
- ✅ Variação de zoom (autofocus)
- ✅ Ruído de sensor
- ✅ Timestamp realista

---

## 🎯 Como Funciona

### Quando você usa IMAGEM:
1. Você seleciona uma imagem no Toolbox
2. Quando o Veriff pede para tirar foto
3. O app captura a imagem com todas as melhorias de liveness
4. Envia como se fosse foto tirada agora

### Quando você usa VÍDEO:
1. Você seleciona um vídeo no Toolbox
2. O vídeo é reproduzido em loop no canvas
3. Quando o Veriff pede para tirar foto
4. O app **captura um FRAME do vídeo** (não o vídeo inteiro)
5. Aplica todas as melhorias de liveness nesse frame
6. Envia como **IMAGEM JPEG** (não vídeo)

**Importante**: O Veriff sempre recebe uma **IMAGEM**, mesmo quando você usa vídeo. O vídeo é usado apenas como fonte para capturar frames.

---

## 📋 Passo a Passo

### 1. Configure a mídia no Toolbox

**Opção A: Usar Imagem**
- Clique em **"📷 Imagem"**
- Selecione uma foto (JPG/PNG)
- Recomendado: foto com boa iluminação e rosto bem visível

**Opção B: Usar Vídeo** (Recomendado)
- Clique em **"🎬 Vídeo"**
- Selecione um vídeo (MP4/WebM)
- Recomendado: vídeo curto (2-5 segundos) com movimento sutil
- O app vai capturar um frame desse vídeo quando necessário

### 2. Vá para o Veriff/Uber

1. Configure o proxy: **127.0.0.1:8080** (BurpSuite)
2. Navegue até o site (ex: `magic.veriff.me`)
3. Aguarde o Veriff pedir para tirar foto

### 3. Tire a foto

- Quando o Veriff pedir, clique em **"Tirar foto"** normalmente
- O app **automaticamente**:
  - Se você usou **imagem**: captura a imagem com melhorias
  - Se você usou **vídeo**: captura um frame do vídeo como imagem com melhorias
- O Veriff recebe uma **IMAGEM JPEG** (não vídeo)

---

## 🔧 Correções Implementadas

### Problema: Vídeo não funcionava
**Causa**: O sistema estava tentando enviar o vídeo inteiro, mas o Veriff precisa de uma imagem.

**Solução**:
- ✅ Quando você seleciona vídeo, o app sempre captura um **FRAME** do vídeo
- ✅ O frame é convertido para **IMAGEM JPEG**
- ✅ Garante que o vídeo está reproduzindo antes de capturar
- ✅ Aguarda frame estável antes de enviar

### Problema: Imagem não era aceita
**Causa**: Faltavam melhorias de liveness para parecer foto tirada ao vivo.

**Solução**:
- ✅ Adicionadas variações sutis entre frames
- ✅ Micro-movimentos, brilho/contraste, zoom, ruído
- ✅ Timestamp muito recente
- ✅ Nome de arquivo realista (formato de câmera)

---

## 💡 Dicas Importantes

### Para IMAGEM:
- ✅ Use foto com **boa qualidade** (1920x1080 ou maior)
- ✅ **Boa iluminação** e rosto bem visível
- ✅ Formato JPG funciona melhor que PNG

### Para VÍDEO:
- ✅ Use vídeo **curto** (2-5 segundos)
- ✅ Com **movimento sutil** (ajuda no liveness)
- ✅ Formato MP4 funciona melhor
- ✅ O app vai capturar um frame automaticamente

### Timing:
- ⏰ **Aguarde alguns segundos** após carregar a página antes de tirar foto
- ⏰ Isso deixa o stream "aquecer" e ficar mais estável
- ⏰ Se usar vídeo, aguarde ele começar a reproduzir

---

## 🐛 Troubleshooting

### Vídeo não está funcionando

**Sintoma**: Erro ao fazer upload, diz que precisa de imagem

**Solução**:
1. Verifique se o vídeo está carregado (aguarde alguns segundos)
2. Tente usar uma **imagem** em vez de vídeo
3. Verifique o console (F12) - deve aparecer `[Liveness] Frame do vídeo capturado`

### Imagem ainda não é aceita

**Sintoma**: A imagem sobe mas volta com erro "We couldn't verify your profile photo"

**Soluções**:
1. **Tente outra imagem** - algumas podem ter características detectáveis
2. **Use vídeo** em vez de imagem - movimento ajuda no liveness
3. **Melhore a qualidade** - use imagem maior e mais nítida
4. **Aguarde mais tempo** - deixe o stream "aquecer" antes de tirar foto
5. **Verifique iluminação** - imagem muito escura/clara pode ser rejeitada

### A interceptação não está funcionando

**Sintoma**: A foto original é enviada (não a nossa)

**Solução**:
1. Abra o console (F12)
2. Procure por mensagens `[Liveness]`
3. Verifique se configurou imagem/vídeo no Toolbox
4. Recarregue a página e tente novamente

---

## 📊 Resumo Técnico

### O que acontece quando você tira foto:

1. **Interceptação**: App intercepta `ImageCapture.takePhoto()` ou `canvas.toBlob()`
2. **Captura**:
   - Se imagem: captura a imagem do canvas
   - Se vídeo: captura um **frame** do vídeo do canvas
3. **Melhorias aplicadas**:
   - Micro-movimentos (±0.5px)
   - Variações de brilho (±2%) e contraste (±1.5%)
   - Variação de zoom (±0.1%)
   - Ruído de sensor (0.3 em 10% dos pixels)
4. **Conversão**: Frame/Imagem → JPEG Blob
5. **Metadata**: Timestamp recente, nome realista
6. **Envio**: File/Blob enviado como se fosse foto tirada agora

**Resultado**: O Veriff sempre recebe uma **IMAGEM JPEG**, mesmo quando você usa vídeo.

---

## ✅ Checklist

Antes de testar:
- [ ] Configurei imagem ou vídeo no Toolbox
- [ ] Proxy configurado (127.0.0.1:8080)
- [ ] Aguardei alguns segundos após carregar a página
- [ ] Console aberto (F12) para ver logs

Ao tirar foto:
- [ ] Cliquei normalmente em "Tirar foto"
- [ ] Vi mensagem `[Liveness]` no console
- [ ] Foto foi enviada automaticamente

Se não funcionar:
- [ ] Tentei outra imagem/vídeo
- [ ] Tentei usar vídeo em vez de imagem
- [ ] Aguardei mais tempo antes de tirar foto
- [ ] Verifiquei qualidade da imagem/vídeo

---

**Lembre-se**: O Veriff sempre recebe uma **IMAGEM**, não vídeo. Se você usar vídeo, o app captura um frame automaticamente! 🎯
