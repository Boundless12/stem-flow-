# 音乐分轨抓取软件 - 开发规则

## 项目概览
全栈音乐分轨应用：Node.js + Express 后端，纯前端单页应用，Python 音频处理。

## 技术栈
- **后端**: Node.js, Express, Multer, uuid
- **前端**: 纯 HTML/CSS/JS, Web Audio API, Canvas API
- **音频处理**: Python + numpy (FFT频段分离)
- **存储**: 本地文件系统 (uploads/ + stems/)

## 代码规范

### 通用规则
- 所有文本默认使用 **中文** 注释和用户界面文案
- 文件名使用小写字母 + 连字符 (kebab-case)
- 关键文件使用驼峰命名字段保持一致性
- 禁用 `var`，统一使用 `const` / `let`
- 异步操作优先使用 `async/await`

### JavaScript/Node.js
- 使用 ES6+ 语法
- REST API 路径前缀 `/api/`
- 错误处理：统一返回 `{ success: boolean, message: string, data?: any }`
- 上传文件路径避免冲突，使用 uuid 生成唯一 ID
- 敏感操作添加防注入处理（文件路径清理等）

### CSS
- 使用 CSS 自定义属性（variables）管理配色
- 深蓝主色调：`--bg-primary: #080E1A`, `--bg-card: rgba(255,255,255,0.04)`
- 橙色点缀：`--accent: #FF6B35`
- 类名使用 kebab-case
- 尽量使用 flexbox/grid 布局

### Python
- 使用 `if __name__ == '__main__':` 入口
- numpy 操作用注释说明信号处理逻辑
- 文件操作使用 `with` 语句
- 外部工具调用（ffmpeg等）使用 subprocess，包含错误处理

## 项目结构规范
```
server.js          # Express 主入口
processor.py       # Python 音频处理
public/
  index.html       # 主页面
  style.css        # 样式
  app.js           # 前端逻辑
uploads/           # 上传音频
stems/             # 分离音轨
```

## 构建与运行
- `npm install` - 安装依赖
- `node server.js` - 启动开发服务器 (端口 3000)
- `scripts/install_demucs.bat` - 安装 Demucs AI 分轨引擎（Windows）
- `bash scripts/install_demucs.sh` - 安装 Demucs AI 分轨引擎（Linux/Mac）
- `python processor.py <input> <output_dir>` - 直接执行音频分离

## AI 分轨引擎

### 处理层级
```
1. Demucs AI  → 深度学习分离（需 PyTorch + demucs）
2. HPSS 增强 → librosa 谐波-打击乐分离（推荐，仅需 librosa）
3. FFT Fast  → 频段切割（仅需 numpy）
4. Fallback  → 占位文件（零依赖）
```

### 安装（国内镜像加速）
运行 `scripts/install_demucs.bat` 一键安装 librosa 引擎：
1. 配置 pip 为清华 TUNA 镜像
2. 安装 librosa + numpy + soundfile
3. 验证安装

**可选：PyTorch + Demucs**（Windows Python 3.14 可能有 DLL 兼容问题）
```
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install demucs torchaudio soundfile einops
```

### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HF_ENDPOINT` | `https://hf-mirror.com` | HuggingFace 镜像（国内加速） |

### 性能指标
- HPSS (librosa): 30秒歌曲 ≈ 3-5秒处理
- 比手写 FFT 分离质量显著提升
- 谐波/打击乐分离干净，人声和鼓组分离度高

## 安全规则
- 用户上传文件路径做防注入清理
- 文件类型严格校验（仅允许 MP3/WAV/FLAC）
- 临时文件定时清理（超过1小时的自动删除）
- 不将凭据硬编码到源代码中
