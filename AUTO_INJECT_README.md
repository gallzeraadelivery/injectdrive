# Auto-Injeção de Vídeo/Imagem - Guia Rápido

## Como Funciona

A auto-injeção **substitui automaticamente** vídeo/imagem em requisições de upload **antes de enviar para o servidor**. Funciona junto com o BurpSuite.

---

## Configuração (config.js)

### Modo Automático (Recomendado) ✅

```javascript
AUTO_INJECT_MEDIA: true,
AUTO_INJECT_MODE: 'auto',  // ← Detecta automaticamente qualquer upload de vídeo/imagem
```

**Como funciona:**
- ✅ **Não precisa** informar URLs/APIs manualmente
- ✅ Detecta **automaticamente** qualquer requisição POST/PUT que contenha vídeo ou imagem
- ✅ Funciona com **qualquer site** (Veriff, Uber, Onfido, etc.)
- ✅ Intercepta tanto **multipart/form-data** quanto **JSON com base64**

### Modo URLs (Avançado)

```javascript
AUTO_INJECT_MEDIA: true,
AUTO_INJECT_MODE: 'urls',  // ← Só intercepta URLs específicas
AUTO_INJECT_URLS: [
  '/upload', '/selfie', '/veriff', '/onfido'
],
```

**Quando usar:**
- Se quiser interceptar **apenas URLs específicas**
- Se o modo automático estiver interceptando requisições indesejadas

---

## Como Usar

### 1. Ativar Auto-Injeção

No `config.js`:
```javascript
AUTO_INJECT_MEDIA: true,  // ← Deixe true para ativar
AUTO_INJECT_MODE: 'auto', // ← Modo automático (recomendado)
```

### 2. Configurar o Arquivo de Substituição

No **Toolbox** (menu flutuante):
1. Clique em **"🔧 Vídeo"** ou **"🔧 Imagem"**
2. Selecione o arquivo que será usado na substituição
3. O status mostrará: `✓ video: seu-arquivo.mp4`

### 3. Usar no Site

1. Configure o proxy no app: **127.0.0.1:8080** (BurpSuite)
2. Vá para o site (ex: Veriff, Uber)
3. Faça o upload da selfie/vídeo normalmente
4. **O app substitui automaticamente** pelo arquivo que você configurou
5. O BurpSuite intercepta a requisição **já com o vídeo/imagem substituído**

---

## Perguntas Frequentes

### ❓ Precisa deixar a interceptação ocorrendo?

**Sim**, mas é automático:
- Se `AUTO_INJECT_MEDIA: true`, a interceptação está **sempre ativa**
- Não precisa fazer nada manualmente
- Se não quiser usar, configure `AUTO_INJECT_MEDIA: false`

### ❓ Precisa informar no código em qual API precisa trocar?

**Não** (no modo automático):
- Com `AUTO_INJECT_MODE: 'auto'`, o app detecta **automaticamente** qualquer upload de vídeo/imagem
- **Não precisa** configurar URLs manualmente
- Funciona com qualquer site/API

**Sim** (no modo URLs):
- Se usar `AUTO_INJECT_MODE: 'urls'`, precisa listar as URLs em `AUTO_INJECT_URLS`
- Útil se quiser interceptar apenas URLs específicas

### ❓ Funciona com BurpSuite?

**Sim!** A substituição acontece **antes** da requisição sair do app:
1. Site faz upload → App intercepta → App substitui vídeo/imagem → BurpSuite vê requisição modificada → Servidor recebe

### ❓ Quais formatos são suportados?

- **Multipart/form-data**: Substitui arquivos `File` em `FormData`
- **JSON com base64**: Substitui campos como `video`, `image`, `file`, `selfie`, `photo`, `media`, `blob`
- **Formatos de vídeo**: `.mp4`, `.webm`, `.mov`
- **Formatos de imagem**: `.jpg`, `.jpeg`, `.png`

---

## Exemplo Prático

### Cenário: Substituir selfie no Veriff

1. **Config.js:**
   ```javascript
   AUTO_INJECT_MEDIA: true,
   AUTO_INJECT_MODE: 'auto',  // Detecta automaticamente
   ```

2. **Toolbox:**
   - Clique em "🔧 Vídeo"
   - Selecione `minha-selfie.mp4`
   - Status: `✓ video: minha-selfie.mp4`

3. **No site:**
   - Vá para `magic.veriff.me`
   - Clique em "Fazer selfie"
   - Faça o upload normalmente

4. **Resultado:**
   - O app substitui automaticamente pelo `minha-selfie.mp4`
   - O BurpSuite intercepta a requisição já modificada
   - O servidor recebe `minha-selfie.mp4` em vez da selfie real

---

## Troubleshooting

### A substituição não está funcionando

1. Verifique se `AUTO_INJECT_MEDIA: true` no `config.js`
2. Verifique se configurou o arquivo no Toolbox (status deve mostrar "✓")
3. Abra o console do DevTools (F12) e procure por `[Auto-Inject]`
4. Verifique se a requisição é POST/PUT e contém vídeo/imagem

### Está interceptando requisições indesejadas

- Mude para modo URLs: `AUTO_INJECT_MODE: 'urls'`
- Configure apenas as URLs desejadas em `AUTO_INJECT_URLS`

### O BurpSuite não está vendo a substituição

- A substituição acontece **dentro do app**, antes de chegar no Burp
- O BurpSuite **deve** ver a requisição já modificada
- Se não estiver vendo, verifique se o proxy está configurado corretamente

---

## Resumo

✅ **Modo Automático**: Não precisa configurar URLs, detecta tudo automaticamente  
✅ **Modo URLs**: Configure URLs específicas se necessário  
✅ **Funciona com BurpSuite**: Requisição já chega modificada  
✅ **Fácil de usar**: Apenas selecione o arquivo no Toolbox  

**Recomendação**: Use `AUTO_INJECT_MODE: 'auto'` para máxima simplicidade! 🚀
