# Enviar o projeto para o GitHub

Como o Git não pode ser executado daqui, rode estes comandos **no Terminal do seu Mac** (na pasta do projeto).

---

## 1. Abrir a pasta e inicializar o Git

```bash
cd /Users/user/Documents/fakecam2025

git init
git add -A
git status
```

Confira se entram só os arquivos do projeto (sem `node_modules`, sem `burp-replacement.*`). Depois:

```bash
git commit -m "Ponto de restauração 2025-02-16 - injeção selfie, aprovação Veriff, liveness"
```

---

## 2. Criar o repositório no GitHub

1. Acesse **https://github.com/new**
2. **Repository name:** por exemplo `fakecam2025` (ou o nome que quiser)
3. Escolha **Private** ou **Public**
4. **Não** marque “Add a README” (o projeto já tem arquivos)
5. Clique em **Create repository**

---

## 3. Conectar e enviar

O GitHub vai mostrar algo como “push an existing repository”. No Terminal:

```bash
git remote add origin https://github.com/SEU_USUARIO/fakecam2025.git
git branch -M main
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuário do GitHub e `fakecam2025` pelo nome do repositório se for diferente.

Se pedir **usuário e senha**: use seu usuário do GitHub e um **Personal Access Token** (senha de app) em vez da senha da conta. Para criar: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (com permissão `repo`).

---

## 4. Próximas vezes

Depois de alterar o projeto:

```bash
git add -A
git commit -m "Descrição da mudança"
git push
```

---

*Se o `git` no Mac pedir instalação das “Command Line Tools”, rode no Terminal: `xcode-select --install` e conclua a instalação.*
