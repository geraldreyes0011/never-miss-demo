#!/usr/bin/env bash
# One-time per session: build espeak-ng and fetch the Kokoro voice model (all from GitHub; ~360 MB).
set -e
H="${TTS_HOME:-$HOME/tts}"; mkdir -p "$H"; cd "$H"
if [ ! -x "$H/es/bin/espeak-ng" ]; then
  [ -d espeak-ng ] || git clone -q --depth 1 https://github.com/espeak-ng/espeak-ng.git
  cmake -S espeak-ng -B espeak-ng/build -DCMAKE_BUILD_TYPE=Release -DUSE_MBROLA=OFF -DUSE_LIBSONIC=OFF -DUSE_LIBPCAUDIO=OFF -DUSE_KLATT=OFF -DUSE_SPEECHPLAYER=OFF -DCMAKE_INSTALL_PREFIX="$H/es" >/dev/null
  cmake --build espeak-ng/build -j8 >/dev/null && cmake --install espeak-ng/build >/dev/null
fi
[ -d ksrc ] || git clone -q --depth 1 https://github.com/thewh1teagle/kokoro-onnx.git ksrc
R=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -s voices-v1.0.bin ] || curl -sSL -o voices-v1.0.bin $R/voices-v1.0.bin
[ -s kokoro-v1.0.onnx ] || curl -sSL -o kokoro-v1.0.onnx $R/kokoro-v1.0.onnx
python3 -c "import onnxruntime, numpy" 2>/dev/null || pip install --break-system-packages -q onnxruntime numpy
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libmp3lame || echo "WARNING: ffmpeg without libmp3lame"
echo "TTS ready in $H"
