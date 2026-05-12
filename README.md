# StemFlow — AI 音乐分轨工具

上传歌曲，AI 自动分离为人声、鼓组、贝斯等独立音轨。

## 功能

- 拖拽上传 MP3 / WAV / FLAC / M4A 音频文件
- 在线音频 URL 抓取并自动分轨
- **Demucs 深度学习 AI** 分离（htdemucs 模型，4 音轨：人声/鼓组/贝斯/其他）
- 音轨预览播放 + 单轨独奏
- 独立下载分离后的高质量 WAV 文件
- Canvas 波形实时可视化

## 快速开始

```bash
npm install          # 安装 Node.js 依赖
pip install librosa numpy soundfile  # 安装 HPSS 备用引擎

# 可选：安装 Demucs 深度学习引擎（最佳分离质量）
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install demucs torchaudio soundfile einops

node server.js       # 启动服务器 → http://localhost:3000
```

> **国内用户**：运行 `scripts/install_demucs.bat` 一键安装，已配置清华 TUNA 镜像加速。

## 架构

```
用户浏览器 (SPA)
     │  HTML/CSS/JS  │  拖拽上传 · 波形绘制 · 播放控制
     ▼  REST API
server.js (Node.js + Express)
     │  Multer 文件接收 / uuid 任务管理
     ▼  subprocess
processor.py (Python)
     ├─ Demucs AI    → htdemucs 深度学习分离 (mode=demucs)
     ├─ HPSS 增强    → librosa 谐波-打击乐分离 (mode=hpss)
     ├─ FFT Fast     → numpy 频段切割 (mode=fft)
     └─ Fallback     → 占位文件 (mode=fallback)
     ▼
stems/{id}/ (4 × WAV)
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML5, CSS3, JavaScript ES6+, Web Audio API, Canvas API |
| 后端 | Node.js, Express, Multer, uuid |
| AI 分轨 | Python 3.11+, PyTorch 2.5+, demucs 4.0+, librosa, numpy |

## 处理模式

| 模式 | 引擎 | 质量 | 速度 (30s 音频) | 依赖 |
|------|------|------|----------------|------|
| `demucs` | Meta htdemucs | ★★★★★ | 2-5 分钟 | PyTorch + demucs |
| `hpss` | librosa HPSS | ★★★☆ | 3-5 秒 | librosa |
| `fft` | numpy FFT | ★★☆ | 1-2 秒 | numpy |
| `fallback` | 占位文件 | ☆ | 即时 | 无 |

## 项目结构

```
├── server.js              # Express 服务器
├── processor.py           # AI 音频分轨处理器
├── public/
│   ├── index.html         # 前端页面
│   ├── style.css          # 深蓝主题样式
│   └── app.js             # 前端交互逻辑
├── scripts/
│   ├── install_demucs.bat # Windows 一键安装 (国内镜像)
│   ├── install_demucs.sh  # Linux/macOS 安装脚本
│   └── demucs_config.json # 模型配置
├── uploads/               # 上传缓存
├── stems/                 # 分离输出
└── vercel.json            # Vercel 部署配置
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务器端口 |
| `HF_ENDPOINT` | `https://hf-mirror.com` | HuggingFace 镜像 |
| `DEMUCS_MODEL` | `htdemucs` | AI 模型名称 |
| `DEMUCS_THREADS` | CPU 核心数 | 推理线程数 |
| `PYTHON_EXE` | `venv/Scripts/python.exe` | Python 解释器路径 |

## License

MIT
