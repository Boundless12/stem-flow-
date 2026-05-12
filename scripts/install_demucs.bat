@echo off
chcp 65001 >nul
title StemFlow AI 分轨引擎安装
echo ============================================
echo  StemFlow - AI 分轨引擎安装（国内镜像）
echo ============================================
echo.
echo 正在检测 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)
python --version
echo.

:: 配置 pip 镜像
echo [1/4] 配置 pip 镜像源（清华 TUNA）...
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn
echo.

:: 安装 librosa + numpy
echo [2/4] 安装 librosa 音频处理引擎...
echo 下载中，请耐心等待...
pip install librosa soundfile numpy --no-input
echo.

:: 验证安装
echo [3/4] 验证安装...
python -c "import librosa; print(f'librosa {librosa.__version__}')" 2>nul
python -c "import numpy; print(f'numpy {numpy.__version__}')" 2>nul
echo.

:: 可选：安装 PyTorch + Demucs（需要 Windows VC++ 2022 运行库）
echo [4/4] 可选：PyTorch + Demucs 深度学习引擎
echo 注意：Python 3.14 在 Windows 上可能存在 PyTorch 兼容问题
echo 如需安装请手动运行：
echo   pip install torch --index-url https://download.pytorch.org/whl/cpu
echo   pip install demucs torchaudio soundfile einops
echo.

echo ============================================
echo  AI 分轨引擎安装完成！
echo ============================================
echo.
echo 已安装:
echo   - librosa (HPSS 增强分离)
echo   - numpy, scipy, soundfile
echo.
echo 启动应用: node server.js
echo 访问地址: http://localhost:3000
echo.
pause
