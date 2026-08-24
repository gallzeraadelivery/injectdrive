@echo off
chcp 65001 >nul
setlocal EnableExtensions

title InjectDrive - Atualizar do GitHub
cd /d "%~dp0"

echo.
echo ========================================
echo   InjectDrive - Atualizar do GitHub
echo ========================================
echo.
echo Pasta: %CD%
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  echo Instale o Git e tente de novo.
  goto :fim
)

if not exist ".git\" (
  echo [ERRO] Esta pasta nao e um repositorio Git.
  echo Clone o projeto ou rode git init + remote.
  goto :fim
)

echo [1/3] Buscando atualizacoes em origin/main...
git fetch origin
if errorlevel 1 (
  echo [ERRO] Falha no git fetch. Verifique internet e acesso ao GitHub.
  goto :fim
)

for /f "delims=" %%i in ('git rev-parse HEAD') do set "LOCAL=%%i"
for /f "delims=" %%i in ('git rev-parse origin/main 2^>nul') do set "REMOTE=%%i"

if "%REMOTE%"=="" (
  echo [ERRO] Nao foi possivel ler origin/main.
  goto :fim
)

if /i "%LOCAL%"=="%REMOTE%" (
  echo.
  echo [OK] Ja esta atualizado. Nenhuma mudanca no GitHub.
  echo.
  goto :deps
)

echo.
echo Ha atualizacoes novas. Aplicando git pull...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo [AVISO] Pull com fast-forward falhou.
  echo Pode haver alteracoes locais conflitantes.
  echo Tentando pull normal...
  git pull origin main
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel atualizar. Resolva conflitos e tente de novo.
    goto :fim
  )
)

echo.
echo [OK] Codigo atualizado do GitHub.

:deps
echo.
echo [2/3] Verificando dependencias npm...
if not exist "package.json" (
  echo [AVISO] package.json nao encontrado. Pulando npm.
  goto :ok
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [AVISO] npm nao encontrado. Pulando instalacao de dependencias.
  goto :ok
)

call npm install
if errorlevel 1 (
  echo [AVISO] npm install retornou erro. Confira a saida acima.
) else (
  echo [OK] Dependencias ok.
)

:ok
echo.
echo [3/3] Status:
git status -sb
echo.
echo ========================================
echo   Atualizacao concluida.
echo   Para abrir o app: abrirnavegador.bat
echo   ou: npm start
echo ========================================
echo.

:fim
pause
endlocal
