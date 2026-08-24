// Versão SIMPLES do script de injeção - apenas o essencial que funcionava
(function() {
  if (window.__MEDIA_INJECTION_LOADED) {
    if (window.__ORIG_FETCH) window.fetch = window.__ORIG_FETCH;
    if (window.__ORIG_XHR_OPEN && window.__ORIG_XHR_SEND) {
      XMLHttpRequest.prototype.open = window.__ORIG_XHR_OPEN;
      XMLHttpRequest.prototype.send = window.__ORIG_XHR_SEND;
    }
  }
  window.__MEDIA_INJECTION_LOADED = true;
  
  let currentMedia = null;
  
  // Escuta atualizações de mídia
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'MEDIA_INJECTION_UPDATE') {
      currentMedia = e.data.media;
      console.log('[Media-Inject] ✅ Mídia atualizada:', currentMedia?.type, currentMedia?.filename);
    }
  });
  
  // Intercepta fetch
  const origFetch = window.fetch;
  window.__ORIG_FETCH = origFetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    const method = (options.method || 'GET').toUpperCase();
    
    if (currentMedia && currentMedia.dataUrl && (method === 'POST' || method === 'PUT') && options.body instanceof FormData) {
      const newFormData = new FormData();
      let replaced = false;
      
      for (const [key, value] of options.body.entries()) {
        if (value instanceof File && value.type.startsWith('image/')) {
          try {
            const blob = await fetch(currentMedia.dataUrl).then(r => r.blob());
            const file = new File([blob], currentMedia.filename || 'image.jpg', { 
              type: currentMedia.mime || blob.type || 'image/jpeg',
              lastModified: Date.now()
            });
            newFormData.append(key, file);
            replaced = true;
            console.log('[Auto-Inject] ✅ Imagem substituída em fetch:', url, 'campo:', key);
          } catch (e) {
            console.error('[Auto-Inject] Erro:', e);
            newFormData.append(key, value);
          }
        } else {
          newFormData.append(key, value);
        }
      }
      
      if (replaced) {
        options.body = newFormData;
      }
    }
    
    return origFetch.apply(this, args);
  };
  
  // Intercepta XMLHttpRequest
  if (!window.__ORIG_XHR_OPEN) {
    window.__ORIG_XHR_OPEN = XMLHttpRequest.prototype.open;
    window.__ORIG_XHR_SEND = XMLHttpRequest.prototype.send;
  }
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__method = method;
    this.__url = url;
    return window.__ORIG_XHR_OPEN.call(this, method, url, ...rest);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (currentMedia && currentMedia.dataUrl && (this.__method === 'POST' || this.__method === 'PUT') && body instanceof FormData) {
      const newFormData = new FormData();
      let replaced = false;
      
      for (const [key, value] of body.entries()) {
        if (value instanceof File && value.type.startsWith('image/')) {
          fetch(currentMedia.dataUrl).then(r => r.blob()).then(blob => {
            const file = new File([blob], currentMedia.filename || 'image.jpg', { 
              type: currentMedia.mime || blob.type || 'image/jpeg',
              lastModified: Date.now()
            });
            const finalFormData = new FormData();
            for (const [k, v] of body.entries()) {
              if (k === key && v === value) {
                finalFormData.append(k, file);
              } else {
                finalFormData.append(k, v);
              }
            }
            window.__ORIG_XHR_SEND.call(this, finalFormData);
          }).catch(() => {
            window.__ORIG_XHR_SEND.call(this, body);
          });
          return;
        }
      }
    }
    
    return window.__ORIG_XHR_SEND.call(this, body);
  };
  
  console.log('[Media-Inject] ✅ Script de injeção carregado');
})();
