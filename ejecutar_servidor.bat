@echo off
TITLE Repuesto Reparable - Servidor Local
echo Iniciando servidor para Repuesto Reparable...
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo iniciar el servidor. Asegurate de tener Node.js instalado.
    pause
)
