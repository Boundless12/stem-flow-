#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo " StemFlow - Demucs AI 分轨引擎安装"
echo "============================================"
echo ""

# Check Python
echo "检测 Python 环境..."
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo "[错误] 未检测到 Python，请先安装 Python 3.10+"
    exit 1
fi

PYTHON=$(command -v python3 || command -v python)
$PYTHON -c "import sys; exit(0 if sys.version_info>=(3,10) else 1)" || {
    echo "[错误] Python 版本需 >= 3.10"
    $PYTHON --version
    exit 1
}
$PYTHON --version
echo ""

# Configure pip mirror
echo "[1/5] 配置 pip 镜像源（清华 TUNA）..."
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || true
pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn 2>/dev/null || true

if [ -f ~/.config/pip/pip.conf ]; then
    echo "pip 镜像已配置: $(grep index-url ~/.config/pip/pip.conf 2>/dev/null || echo '~/.pip/pip.conf')"
fi
echo ""

# Install PyTorch
echo "[2/5] 安装 PyTorch CPU（镜像加速）..."
echo "下载大小约 200-400MB，请耐心等待..."
pip install torch --index-url https://mirrors.tuna.tsinghua.edu.cn/pytorch/whl/cpu 2>/dev/null || {
    echo "[警告] 镜像安装失败，尝试官方源..."
    pip install torch --index-url https://download.pytorch.org/whl/cpu
}
echo ""

# Install demucs
echo "[3/5] 安装 demucs + 音频处理依赖..."
pip install demucs soundfile einops 2>/dev/null || pip install demucs soundfile einops
echo ""

# Verify
echo "[4/5] 验证安装..."
$PYTHON -c "import torch; print(f'PyTorch {torch.__version__} (CPU)')" 2>/dev/null
$PYTHON -c "import demucs; print('demucs imported OK')" 2>/dev/null || {
    echo "[警告] demucs 导入失败，尝试从 GitHub 安装..."
    pip install git+https://github.com/facebookresearch/demucs.git
}
echo ""

# Pre-cache model
echo "[5/5] 预缓存 htdemucs 模型（约 400MB）..."
export HF_ENDPOINT=https://hf-mirror.com
export TORCH_HOME="${HOME}/.cache/torch"
export DEMUCS_CACHE="${HOME}/.cache/demucs"
mkdir -p "${TORCH_HOME}" "${DEMUCS_CACHE}"

$PYTHON -c "
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
print('正在下载 htdemucs 模型权重...')
print('（如果下载失败，请检查网络或设置其他 HF 镜像）')
try:
    from demucs import pretrained
    model = pretrained.get_model('htdemucs')
    print(f'模型加载成功: htdemucs')
    print(f'采样率: {model.samplerate}Hz, 音轨数: {model.sources}')
except Exception as e:
    print(f'模型缓存失败: {e}')
    print('首次运行时会自动下载')
"
echo ""

# Shell profile config
echo "配置 HF_ENDPOINT 环境变量..."
SHELL_CONFIG="${HOME}/.$(basename ${SHELL:-bash})rc"
if ! grep -q 'HF_ENDPOINT' "${SHELL_CONFIG}" 2>/dev/null; then
    echo 'export HF_ENDPOINT=https://hf-mirror.com' >> "${SHELL_CONFIG}"
    echo "已添加到 ${SHELL_CONFIG}"
fi
echo ""

# Done
echo "============================================"
echo " Demucs AI 分轨引擎安装完成！"
echo "============================================"
echo ""
echo "已配置:"
echo "  - pip 镜像: pypi.tuna.tsinghua.edu.cn"
echo "  - PyTorch 镜像: mirrors.tuna.tsinghua.edu.cn/pytorch/whl/cpu"
echo "  - HF 镜像: hf-mirror.com"
echo ""
echo "启动应用: node server.js"
echo "访问地址: http://localhost:3000"
