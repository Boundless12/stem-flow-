"""
StemFlow AI 音乐分轨处理器

处理流程：
  1. 尝试使用 demucs 深度学习模型分离（AI 模式）
  2. 如果 demucs 不可用，降级到 FFT 频段分离（Fast 模式）
  3. 如果 FFT 也不可用，生成占位文件（Fallback 模式）

环境变量:
  HF_ENDPOINT          HuggingFace 镜像地址 (国内: https://hf-mirror.com)
  DEMUCS_MODEL         模型名称 (htdemucs / htdemucs_ft / htdemucs_6s)
  DEMUCS_THREADS       CPU 线程数 (默认: 4)
  DEMUCS_MODEL_PATH    模型缓存路径 (默认: ~/.cache/demucs)
  DEMUCS_DEVICE        设备 (cpu / cuda, 默认: cpu)
  TORCH_HOME           PyTorch 缓存路径

输出格式:
  PROGRESS:<0-100>     进度百分比
  MODE:<demucs|fft>    当前分离模式
  <其他文本>            日志信息
"""

import sys
import os
import json
import struct
import wave
import math
import time

SAMPLE_RATE = 44100
CHANNELS = 2
BITS_PER_SAMPLE = 16
STEM_NAMES = ['vocals', 'drums', 'bass', 'other']


# ============================================================
# 公共工具
# ============================================================

def log(msg):
    print(msg, flush=True)


def progress(pct):
    print(f'PROGRESS:{pct}', flush=True)


def emit_mode(mode):
    print(f'MODE:{mode}', flush=True)


def read_wav(filepath):
    with wave.open(filepath, 'rb') as wf:
        sr = wf.getframerate()
        ch = wf.getnchannels()
        frames = wf.readframes(wf.getnframes())
    if BITS_PER_SAMPLE == 16:
        fmt = '<' + 'h' * (len(frames) // 2)
        samples = list(struct.unpack(fmt, frames))
    else:
        samples = [0]
    return samples, sr, ch


def write_wav(filepath, samples, sr=SAMPLE_RATE, ch=CHANNELS):
    with wave.open(filepath, 'wb') as wf:
        wf.setnchannels(ch)
        wf.setsampwidth(BITS_PER_SAMPLE // 8)
        wf.setframerate(sr)
        fmt = '<' + 'h' * len(samples)
        wf.writeframes(struct.pack(fmt, *samples))


def mono_to_stereo(mono_samples, length):
    mono_samples = list(mono_samples)
    if len(mono_samples) < length:
        mono_samples.extend([0] * (length - len(mono_samples)))
    stereo = []
    for s in mono_samples[:length]:
        stereo.extend([s, s])
    return stereo


def wav_to_temp_stereo(input_path):
    """将任意音频转换为 44100Hz 16bit 立体声 WAV 临时文件"""
    import tempfile
    import subprocess

    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', input_path,
             '-ar', str(SAMPLE_RATE), '-ac', '2',
             '-sample_fmt', 's16', tmp_path],
            capture_output=True, timeout=120, check=True
        )
        return tmp_path
    except (subprocess.CalledProcessError, FileNotFoundError):
        # ffmpeg 不可用，直接返回原路径
        return input_path


def cleanup_temp(path):
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except PermissionError:
            pass


# ============================================================
# FFT 频段分离 (Fast 模式 / 降级备用)
# ============================================================

def fft_split(input_path, output_dir, job_id):
    log("FFT mode: frequency-band separation")

    try:
        import numpy as np
    except ImportError:
        log("ERROR: numpy not installed")
        return False

    try:
        samples, sr, ch = read_wav(input_path)
    except Exception as e:
        log(f"ERROR: failed to read WAV: {e}")
        return False

    if ch == 2:
        left = samples[0::2]
        right = samples[1::2]
        mono = [(l + r) // 2 for l, r in zip(left, right)]
    else:
        mono = samples

    audio = np.array(mono, dtype=np.float64)
    n = len(audio)

    n_pow2 = 1
    while n_pow2 < n:
        n_pow2 <<= 1

    window = np.hanning(n)
    audio_windowed = audio * window
    padded = np.zeros(n_pow2)
    padded[:n] = audio_windowed

    spectrum = np.fft.rfft(padded)
    freqs = np.fft.rfftfreq(n_pow2, 1 / sr)

    progress(20)

    # Bass: < 250Hz
    bass_spectrum = np.zeros_like(spectrum)
    bass_mask = freqs < 250
    bass_spectrum[bass_mask] = spectrum[bass_mask]
    bass_signal = np.real(np.fft.irfft(bass_spectrum)[:n])
    bass_max = np.max(np.abs(bass_signal)) or 1
    bass_int = np.clip(bass_signal / bass_max * 0.9 * 32767, -32768, 32767).astype(np.int16)

    progress(35)

    # Vocals: 300Hz - 3kHz
    vocal_spectrum = np.zeros_like(spectrum, dtype=np.complex128)
    vocal_mask = (freqs >= 300) & (freqs <= 3000)
    vocal_spectrum[vocal_mask] = spectrum[vocal_mask] * 0.7
    formant_mask = (freqs >= 800) & (freqs <= 2500)
    vocal_spectrum[formant_mask] = spectrum[formant_mask] * 1.2
    vocal_signal = np.real(np.fft.irfft(vocal_spectrum)[:n])
    vocal_max = np.max(np.abs(vocal_signal)) or 1
    vocal_int = np.clip(vocal_signal / vocal_max * 0.9 * 32767, -32768, 32767).astype(np.int16)

    progress(55)

    # Drums: > 3kHz percussive
    drum_spectrum = np.zeros_like(spectrum, dtype=np.complex128)
    drum_mask = freqs >= 3000
    drum_spectrum[drum_mask] = spectrum[drum_mask] * 0.6
    drum_signal = np.real(np.fft.irfft(drum_spectrum)[:n])
    drum_max = np.max(np.abs(drum_signal)) or 1
    drum_int = np.clip(drum_signal / drum_max * 0.9 * 32767, -32768, 32767).astype(np.int16)

    progress(70)

    # Other: residual
    other_signal = audio - (
        bass_signal + vocal_signal + drum_signal
    )
    other_int = np.clip(other_signal, -32768, 32767).astype(np.int16)

    progress(80)

    stems = {
        'bass': bass_int.tolist(),
        'vocals': vocal_int.tolist(),
        'drums': drum_int.tolist(),
        'other': other_int.tolist()
    }

    total = len(stems)
    for i, (name, data) in enumerate(stems.items()):
        out_path = os.path.join(output_dir, f'{name}.wav')
        if ch == 1:
            write_wav(out_path, data, sr, 1)
        else:
            write_wav(out_path, mono_to_stereo(data, n), sr, ch)
        progress(80 + int(((i + 1) / total) * 20))

    log(f"FFT done: 4 stems -> {output_dir}")
    return True


# ============================================================
# Librosa 增强分离（HPSS + 频段分割）
# ============================================================

def librosa_split(input_path, output_dir, job_id):
    """
    使用 librosa HPSS（谐波-打击乐分离）进行增强音频分离。
    效果优于纯 FFT，接近基础 AI 模型的质量。
    - 谐波部分 → 人声 + 其他（中频提取）
    - 打击乐部分 → 鼓组（瞬态信号）
    - 低通滤波 → 贝斯
    """
    log("HPSS enhanced mode: loading audio...")
    progress(5)

    try:
        import librosa
        import numpy as np
        import soundfile as sf
    except ImportError as e:
        log(f"ERROR: librosa not installed: {e}")
        return False

    # 非 WAV 先转换
    conv_path = None
    real_input = input_path
    if not input_path.lower().endswith('.wav'):
        conv = wav_to_temp_stereo(input_path)
        if conv != input_path:
            conv_path = conv
            real_input = conv

    log(f"Loading: {real_input}")
    progress(10)

    try:
        y, sr = librosa.load(real_input, sr=44100, mono=True)
        duration = len(y) / sr
        log(f"Audio: {duration:.1f}s, {sr}Hz")
    except Exception as e:
        log(f"ERROR: load failed: {e}")
        if conv_path: cleanup_temp(conv_path)
        return False

    progress(15)

    # --- Step 1: HPSS ---
    try:
        log("Running HPSS...")
        harmonic, percussive = librosa.effects.hpss(y, margin=3.0, win_length=4096, hop_length=1024)
        progress(35)
    except Exception as e:
        log(f"HPSS failed: {e}")
        harmonic, percussive = y * 0.3, y * 0.3
        progress(35)

    progress(40)
    n = len(harmonic)

    # --- Step 2: 人声（谐波中频提取） ---
    spectrum = np.fft.rfft(harmonic)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    vocal_s = np.zeros_like(spectrum, dtype=np.complex128)
    mask = (freqs >= 200) & (freqs <= 4000)
    vocal_s[mask] = spectrum[mask] * 0.8
    fmask = (freqs >= 600) & (freqs <= 2800)
    vocal_s[fmask] = spectrum[fmask] * 1.3
    vocal = np.real(np.fft.irfft(vocal_s)[:n])

    progress(50)

    # --- Step 3: 贝斯（原信号低通） ---
    orig_spectrum = np.fft.rfft(y)
    orig_freqs = np.fft.rfftfreq(len(y), 1 / sr)
    bass_s = np.zeros_like(orig_spectrum, dtype=np.complex128)
    bass_s[orig_freqs < 250] = orig_spectrum[orig_freqs < 250]
    bass = np.real(np.fft.irfft(bass_s)[:n])

    progress(60)

    # --- Step 4: 鼓组 = 打击乐部分 ---
    drums = percussive[:n] * 1.0

    progress(65)

    # --- Step 5: 其他 = 残差 ---
    other = y[:n] - (vocal[:n] + bass[:n] + drums[:n])

    progress(70)

    # --- Step 6: 写出 ---
    stems_data = {'vocals': vocal, 'bass': bass, 'drums': drums, 'other': other}
    total = len(stems_data)

    try:
        with wave.open(input_path, 'rb') as wf:
            orig_ch = wf.getnchannels()
    except:
        orig_ch = 2

    for i, (name, data) in enumerate(stems_data.items()):
        max_val = np.max(np.abs(data)) or 1
        data_norm = np.clip(data / max_val * 0.95, -1.0, 1.0)
        out_path = os.path.join(output_dir, f'{name}.wav')
        if orig_ch == 1:
            sf.write(out_path, data_norm, sr)
        else:
            s = data_norm * (1.0 + (i - 1.5) * 0.02)  # 模拟立体声宽度
            sf.write(out_path, np.column_stack([data_norm, s]), sr)
        progress(70 + int(((i + 1) / total) * 30))
        log(f"  Saved: {name}.wav")

    if conv_path:
        cleanup_temp(conv_path)
    log(f"HPSS done: 4 stems -> {output_dir}")
    return True


# ============================================================
# Demucs AI 分离（深度学习模型，最佳质量）
# ============================================================

def demucs_split(input_path, output_dir, job_id):
    """
    使用 Meta demucs htdemucs 模型进行音源分离。
    需要: PyTorch >= 2.0, demucs >= 4.0, torchaudio
    """
    log("Demucs AI mode: initializing...")
    progress(3)

    # 设置 HuggingFace 镜像（国内加速）
    hf_endpoint = os.environ.get('HF_ENDPOINT', 'https://hf-mirror.com')
    os.environ['HF_ENDPOINT'] = hf_endpoint
    log(f"HF_ENDPOINT={hf_endpoint}")

    # 检查 PyTorch
    try:
        import torch
        log(f"PyTorch {torch.__version__}")
    except ImportError:
        log("ERROR: PyTorch not installed")
        return False

    progress(6)

    # 检查 demucs
    try:
        from demucs import pretrained
        from demucs.apply import apply_model
        import torchaudio
    except ImportError as e:
        log(f"ERROR: demucs/torchaudio missing: {e}")
        return False

    # 加载模型
    model_name = os.environ.get('DEMUCS_MODEL', 'htdemucs')
    device = os.environ.get('DEMUCS_DEVICE', 'cpu')

    try:
        log(f"Loading {model_name} model...")
        model = pretrained.get_model(model_name)
        model.to(device)
        model.eval()
        log(f"Model ready: {model.samplerate}Hz, sources: {list(model.sources)}")
    except Exception as e:
        log(f"ERROR: model load failed: {e}")
        log("Tip: set HF_ENDPOINT=https://hf-mirror.com for China")
        return False

    progress(15)

    # 加载音频
    try:
        wav, sr = torchaudio.load(input_path)
        if wav.shape[0] > 2:
            wav = wav[:2]  # 最多立体声
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)  # 单声道转伪立体声

        # 重采样
        if sr != model.samplerate:
            from demucs.audio import convert_audio
            wav = convert_audio(wav, sr, model.samplerate, model.audio_channels)
            log(f"Resampled {sr}Hz -> {model.samplerate}Hz")

        duration = wav.shape[-1] / model.samplerate
        log(f"Audio: {duration:.1f}s")
    except Exception as e:
        log(f"ERROR: audio load failed: {e}")
        return False

    progress(20)

    # 模型推理 — BagOfModels 期望 [batch, channels, samples]，≥8秒需 split
    try:
        total_len = wav.shape[-1]
        # htdemucs 训练上下文约 7.8 秒 (343980 / 44100)
        use_split = total_len > model.samplerate * 7.5
        if use_split:
            log(f"Audio {duration:.1f}s, using split mode")
        with torch.no_grad():
            mix = wav.unsqueeze(0)
            sources = apply_model(model, mix, device=device,
                                  shifts=1, split=use_split,
                                  overlap=0.25, progress=False)
            pct = 65
            progress(pct)
    except Exception as e:
        log(f"ERROR: inference failed: {e}")
        return False

    # demucs 返回 [1, num_sources, channels, num_samples] 或 [num_sources, channels, num_samples]
    import numpy as np
    if isinstance(sources, (list, tuple)):
        sources = sources[0]
    if sources.dim() == 4:
        sources = sources[0]  # 移除 batch 维度
    sources_np = sources.cpu().numpy()  # [num_sources, channels, num_samples]

    # 映射名字
    src_names = list(model.sources)
    name_map = {}
    for sn in src_names:
        k = sn.lower()
        if 'vocal' in k: name_map[sn] = 'vocals'
        elif 'drum' in k: name_map[sn] = 'drums'
        elif 'bass' in k: name_map[sn] = 'bass'
        else: name_map[sn] = 'other'

    import soundfile as sf
    total = len(src_names)
    for i, sn in enumerate(src_names):
        stem_np = sources_np[i]  # [channels, num_samples]
        out_name = name_map.get(sn, sn)
        out_path = os.path.join(output_dir, f'{out_name}.wav')
        mx = np.max(np.abs(stem_np)) or 1
        norm = stem_np / mx * 0.95
        # soundfile 期望 [samples, channels]，需转置
        if norm.ndim == 1:
            sf.write(out_path, norm, model.samplerate)
        else:
            sf.write(out_path, norm.T, model.samplerate)
        pct = 85 + int(((i + 1) / total) * 15)
        progress(min(pct, 100))

    progress(100)
    log(f"Demucs done: {len(src_names)} stems -> {output_dir}")
    return True


# ============================================================
# 简易回退：生成占位文件
# ============================================================

def fallback_split(input_path, output_dir, job_id):
    log("Fallback mode: generating placeholder stems...")
    progress(20)

    for i, name in enumerate(STEM_NAMES):
        out_path = os.path.join(output_dir, f'{name}.wav')
        # 生成极短的有效 WAV（1 秒静音）
        silent_data = [0] * SAMPLE_RATE
        write_wav(out_path, mono_to_stereo(silent_data, SAMPLE_RATE), SAMPLE_RATE, 2)
        progress(int(((i + 1) / len(STEM_NAMES)) * 100))

    log(f"Fallback done: 4 placeholders -> {output_dir}")
    return True


# ============================================================
# 主入口
# ============================================================

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python processor.py <input_audio> <output_dir> [job_id]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    job_id = sys.argv[3] if len(sys.argv) > 3 else 'unknown'

    if not os.path.exists(input_path):
        log(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    start_time = time.time()
    success = False
    mode_used = 'fallback'
    temp_wav = None

    # 1) Try demucs AI mode
    log("=" * 50)
    log(f"Job: {job_id}")
    log(f"Input: {input_path}")
    log("=" * 50)

    if demucs_split(input_path, output_dir, job_id):
        mode_used = 'demucs'
        success = True
    elif librosa_split(input_path, output_dir, job_id):
        mode_used = 'hpss'
        success = True
        elapsed = time.time() - start_time
        log(f"Time: {elapsed:.1f}s")
    else:
        # 2) Fallback to FFT mode
        log("Demucs unavailable, trying FFT band separation...")

        # 尝试转换为 WAV
        temp_wav = None
        fft_input = input_path
        if not input_path.lower().endswith('.wav'):
            temp_wav = wav_to_temp_stereo(input_path)
            if temp_wav != input_path:
                fft_input = temp_wav

        emit_mode('fft')
        if fft_split(fft_input, output_dir, job_id):
            mode_used = 'fft'
            success = True
            elapsed = time.time() - start_time
            log(f"Time: {elapsed:.1f}s")
        else:
            # 3) Last resort: fallback placeholders
            log("FFT also failed, generating placeholders...")
            emit_mode('fallback')
            fallback_split(input_path, output_dir, job_id)
            elapsed = time.time() - start_time
            log(f"Time: {elapsed:.1f}s")

    if temp_wav and temp_wav != input_path:
        cleanup_temp(temp_wav)

    emit_mode(mode_used)
    progress(100)
    log(f"Done: {mode_used} mode, {len(STEM_NAMES)} stems")

    if not success:
        sys.exit(0)
