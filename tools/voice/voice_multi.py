"""Voice-over for the multi-industry demo. Identical lines are recorded once.

usage: python3 voice_multi.py data/demo.json public/audio [voice] [map.json]
  -> public/audio/c<md5>.mp3 for every line that doesn't have a clip yet
  -> data/audio-map.json  (line key -> clip id; defaults to audio-map.json next to demo.json)
  -> removes c*.mp3 clips that no line references any more

Clip ids are "c" + md5(spoken text)[:8], so a clip is only re-recorded when its words change.
The voice never says a client's name: {biz} is spoken as "your business", {cust} as the demo customer.
"""
import glob, hashlib, json, os, re, subprocess, sys, wave

H = os.environ.get("TTS_HOME", os.path.expanduser("~/tts"))
ES = f"{H}/es/bin/espeak-ng"; ESDATA = f"{H}/es/share/espeak-ng-data"
demo_path = sys.argv[1]; out = sys.argv[2]; os.makedirs(out, exist_ok=True)
VOICE = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
MAP = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(demo_path)), "audio-map.json")
demo = json.load(open(demo_path, encoding="utf-8"))

def clean(s):
    s = s.replace("{biz}", "your business").replace("{cust}", demo.get("customer", "Maya"))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()

_model = None
def model():
    """Load Kokoro only when a clip actually needs recording."""
    global _model
    if _model is None:
        import numpy as np, onnxruntime as ort
        vocab = json.load(open(f"{H}/ksrc/src/kokoro_onnx/config.json"))["vocab"]
        voices = np.load(f"{H}/voices-v1.0.bin")
        sess = ort.InferenceSession(f"{H}/kokoro-v1.0.onnx", providers=["CPUExecutionProvider"])
        ins = {i.name: i.type for i in sess.get_inputs()}
        _model = (np, vocab, voices, sess, ins, "input_ids" if "input_ids" in ins else "tokens")
    return _model

def ipa(chunk):
    o = subprocess.run([ES, "-q", "--ipa", "-v", "en-us", chunk], capture_output=True, text=True, env={"ESPEAK_DATA_PATH": ESDATA}).stdout
    return " ".join(o.split())

def phonemize(text, vocab):
    res = ""
    for p in re.split(r"([,.!?;:])", text):
        if not p.strip(): continue
        res = res.rstrip() + p + " " if p in ",.!?;:" else res + ipa(p) + " "
    return "".join(c for c in res.strip() if c in vocab)

def tts(text, path):
    np, vocab, voices, sess, ins, TOK = model()
    toks = [vocab[c] for c in phonemize(text, vocab)][:509]
    feed = {TOK: np.array([[0, *toks, 0]], dtype=np.int64), "style": np.asarray(voices[VOICE][len(toks) - 1], dtype=np.float32),
            "speed": np.array([1.0], dtype=np.int32 if "int" in ins["speed"] else np.float32)}
    a = np.concatenate([np.zeros(2400), sess.run(None, feed)[0].squeeze(), np.zeros(4800)])
    wav = path[:-4] + ".wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "32k", "-ac", "1", path], check=True)
    os.remove(wav)
    return len(a) / 24000

lines = {"intro": demo["intro"], "outro": demo["outro"]}
for ind in demo.get("order") or list(demo["industries"]):
    for i, s in enumerate(demo["industries"][ind]["steps"], 1): lines[f"{ind}/s{i}"] = s

amap, created = {}, []
for k, sec in lines.items():
    text = clean(sec.get("voice") or sec["say"])
    cid = "c" + hashlib.md5(text.encode()).hexdigest()[:8]
    amap[k] = cid
    path = f"{out}/{cid}.mp3"
    if not os.path.exists(path):
        secs = tts(text, path); created.append(cid); print(f"+ {cid} {secs:.1f}s  {text}")

used = set(amap.values())
removed = []
for f in glob.glob(f"{out}/c*.mp3"):
    cid = os.path.basename(f)[:-4]
    if re.fullmatch(r"c[0-9a-f]{8}", cid) and cid not in used:
        os.remove(f); removed.append(cid); print(f"- {cid} (no longer used)")

old = None
if os.path.exists(MAP):
    try: old = json.load(open(MAP, encoding="utf-8"))
    except ValueError: pass
if old != amap:
    with open(MAP, "w", encoding="utf-8") as fh: json.dump(amap, fh, indent=1)
print(f"{len(lines)} lines, {len(used)} unique clips: {len(created)} recorded, {len(removed)} removed, map {'updated' if old != amap else 'unchanged'}")
