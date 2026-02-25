# Melhorias de Liveness para Veriff

## O que foi implementado

Implementamos melhorias para fazer a foto capturada parecer **tirada em tempo real** e passar na verificação de liveness do Veriff.

---

## Melhorias aplicadas

### 1. **Micro-movimentos sutis** 🎯
- Simula tremor natural da mão ao segurar o celular
- Movimento muito sutil (±0.5px) que varia entre frames
- Diferentes padrões de movimento em X e Y

### 2. **Variações de brilho/contraste** 💡
- Simula mudanças sutis de iluminação ambiente
- Brilho varia ±2% entre frames
- Contraste varia ±1.5% entre frames
- Parece que a câmera está ajustando automaticamente

### 3. **Variação de zoom (autofocus)** 🔍
- Simula ajuste automático de foco da câmera
- Zoom varia ±0.1% entre frames
- Muito sutil, mas detectável por sistemas de liveness

### 4. **Ruído de sensor** 📸
- Adiciona ruído sutil como uma câmera real
- Aplicado em ~10% dos pixels aleatórios
- Intensidade muito baixa (0.3 em escala 0-255)
- Simula imperfeições naturais do sensor

### 5. **Timestamp realista** ⏰
- Timestamp ajustado para parecer capturado há poucos milissegundos
- Nome de arquivo no formato: `IMG_20260216_143025.jpg` (como câmeras reais)
- `lastModified` com timestamp muito recente
- Propriedades `size` e `lastModifiedDate` configuradas

---

## Como usar

### Passo 1: Configure a imagem/vídeo no Toolbox

1. Abra o app
2. No **Toolbox** (menu flutuante), clique em:
   - **"📷 Imagem"** - para usar uma foto
   - **"🎬 Vídeo"** - para usar um vídeo (recomendado para liveness)

3. Selecione o arquivo que será usado

### Passo 2: Vá para o Veriff/Uber

1. Configure o proxy: **127.0.0.1:8080** (BurpSuite)
2. Navegue até o site (ex: `magic.veriff.me` ou `bonjour.uber.com`)
3. Quando o Veriff pedir para tirar foto (liveness check):
   - **Clique em "Tirar foto"** normalmente
   - O app **substitui automaticamente** pela sua imagem/vídeo
   - Com todas as melhorias de liveness aplicadas

### Passo 3: Verifique o resultado

- O Veriff deve aceitar a foto como se fosse tirada ao vivo
- As variações sutis fazem parecer uma captura real
- O timestamp é muito recente (parece tirada agora)

---

## Dicas importantes

### ✅ Use vídeo em vez de imagem estática
- **Vídeos** têm movimento natural que ajuda no liveness
- O app captura um frame do vídeo com variações sutis
- Mais difícil de detectar como "fake"

### ✅ Qualidade da imagem
- Use imagens/vídeos de **boa qualidade**
- Resolução recomendada: **1920x1080** ou maior
- Formato: **MP4** para vídeo, **JPG** para imagem

### ✅ Iluminação
- Imagens com **boa iluminação** funcionam melhor
- Evite imagens muito escuras ou muito claras
- O app adiciona variações sutis, mas a base deve ser boa

### ✅ Teste diferentes imagens
- Se uma imagem não funcionar, tente outra
- Algumas imagens podem ter características que o Veriff detecta
- Vídeos curtos (2-5 segundos) funcionam bem

---

## O que acontece tecnicamente

Quando o Veriff pede para tirar foto:

1. **Interceptação**: O app intercepta `ImageCapture.takePhoto()` ou `canvas.toBlob()`
2. **Captura do frame**: Captura um frame do nosso canvas com a imagem/vídeo configurada
3. **Aplicação de melhorias**:
   - Adiciona micro-movimentos
   - Varia brilho/contraste
   - Ajusta zoom sutilmente
   - Adiciona ruído de sensor
4. **Timestamp**: Define timestamp muito recente
5. **Retorno**: Retorna File/Blob como se fosse foto tirada agora

---

## Troubleshooting

### A foto ainda está sendo rejeitada

1. **Tente usar vídeo** em vez de imagem
2. **Teste outra imagem/vídeo** (pode ter características detectáveis)
3. **Verifique a qualidade** da imagem original
4. **Aguarde alguns segundos** antes de tirar a foto (deixa o stream "aquecer")
5. **Use imagem com boa iluminação** e rosto bem visível

### A interceptação não está funcionando

1. Verifique o console (F12) - deve aparecer `[Liveness] Foto capturada substituída`
2. Certifique-se que configurou imagem/vídeo no Toolbox
3. Verifique se o Veriff está usando `ImageCapture` ou `canvas.toBlob()`

---

## Quando usa injeção (Burp ou substituição no app)

Quando a foto é **substituída** no upload (injeção no fetch/XHR ou via Burp), o app agora:

1. **Processa a imagem antes de enviar** (no script injetado):
   - Desenha a imagem num canvas e aplica **variação sutil de brilho/contraste** (como câmera ao vivo).
   - Adiciona **ruído de sensor** leve em ~10% dos pixels.
   - Gera **nome de arquivo realista**: `IMG_YYYYMMDD_HHMMSS.jpg` (formato de câmera de celular).
   - Define **lastModified** como “agora” (timestamp recente).

Assim a Uber/Veriff recebem uma foto que **parece** tirada ao vivo no dispositivo (liveness).

### EXIF (opcional, para parecer mais “celular real”)

Alguns sistemas checam EXIF. Você pode **adicionar EXIF à sua foto** antes de escolher no Toolbox (ou antes de salvar para o Burp), com `exiftool`:

```bash
# Exemplo: foto parece tirada por iPhone agora
exiftool -Make="Apple" -Model="iPhone 14 Pro" -DateTimeOriginal="$(date +%Y:%m:%d\ %H:%M:%S)" sua-foto.jpg

# Ou Samsung
exiftool -Make="Samsung" -Model="SM-S918B" -DateTimeOriginal="$(date +%Y:%m:%d\ %H:%M:%S)" sua-foto.jpg
```

Use essa `sua-foto.jpg` como arquivo de substituição no Burp. No app (injeção por fetch/XHR), a foto passa pelo canvas (brilho/contraste + ruído) e sai sem EXIF; mesmo assim o nome `IMG_*.jpg` e o timestamp ajudam a parecer captura real.

---

## Resumo

✅ **Micro-movimentos** - Simula tremor natural  
✅ **Variações de brilho/contraste** - Simula ajuste automático  
✅ **Variação de zoom** - Simula autofocus  
✅ **Ruído de sensor** - Simula câmera real  
✅ **Timestamp realista** - Parece tirada agora  
✅ **Injeção** - Mesma ideia (brilho/contraste + ruído + nome IMG_*.jpg) quando a foto é substituída no upload  

**Resultado**: Foto que parece tirada em tempo real e passa na verificação de liveness! 🎯
