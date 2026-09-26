# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx>=0.4"]
# ///
"""Narration voice tool: turns narration scripts into mp3s with Kokoro, a free local neural TTS,
or with MiniMax's hosted TTS when a script says "engine": "minimax" (needs MINIMAX_API_KEY).

  uv run tools/voice.py say "Hello there."          # preview one line (plays it)
  uv run tools/voice.py voices                     # list voice ids
  uv run tools/voice.py lint narration/pages.json  # check a script against narration/STYLE.md
  uv run tools/voice.py build narration/pages.json # render a lesson's lines
  uv run tools/voice.py deploy                     # publish audio/ to Cloudflare

A narration file looks like:
  {"lesson": "pages", "voice": "af_heart", "speed": 1.0,
   "speakers": {"interviewer": {"voice": "bm_george", "label": "Interviewer"}},
   "lines": {
    "intro.1": "Caption, <b>markup</b> stripped before speaking.",
    "intro.2": {"caption": "You wanted <b>{bytes} B</b>.", "voice": "What the narrator says instead."},
    "quiz.q1": {"caption": "A question.", "speaker": "interviewer"}}}
Captions with {placeholders} need a "voice" text, since audio can't fill them in. Lines without
a speaker use the script's own voice. narration/lexicon.json respells terms in the voice text
only (InnoDB -> "Inno D B"), so captions keep the real names.

build writes audio/<lesson>/<id>.mp3, audio/<lesson>/manifest.json ({id: {hash, ms}}), and
narration/<lesson>.js: the captions plus that manifest as a plain script, so the site can load
them without fetch (which browsers block for pages opened from file://). Rebuild after any edit.
Unchanged lines are skipped; lines removed from the script have their mp3 deleted.
Models (~340 MB) download once to ~/.cache/kokoro-onnx.

audio/ is not committed. deploy uploads it as an assets-only Cloudflare Worker named
AUDIO_PROJECT (free static hosting, served from <name>.<subdomain>.workers.dev) with wrangler;
run `npx wrangler login` once. The site reads audio from the address in index.html's
<meta name="audio-base">, and from the local audio/ folder when served from localhost.
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
import os
import urllib.request
from pathlib import Path

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
MODEL_FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
CACHE = Path.home() / ".cache" / "kokoro-onnx"
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VOICE = "af_heart"
SAMPLE_RATE = 24000
# Speech stays clear at 40 kbps mono; changing this re-renders every line (it's part of the hash).
BITRATE = "40k"
AUDIO_PROJECT = "nout-audio"
# MiniMax (hosted TTS): a script opts in with "engine": "minimax"; its voices are MiniMax voice ids
# (list them with `voices --engine minimax`). Audio comes back as mp3 and is stored as is.
MINIMAX_URL = "https://api.minimax.io/v1/t2a_v2"
MINIMAX_MODEL = "speech-2.8-hd"
MINIMAX_BITRATE = 64000
# Cloudflare static-asset headers for audio/: file names are stable but URLs carry ?v=<hash>, so
# cache hard; CORS lets the site prefetch lines with fetch().
HEADERS = """/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
"""


def model():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in MODEL_FILES:
        path = CACHE / name
        if not path.exists():
            print(f"Downloading {name}…", file=sys.stderr)
            partial = path.with_suffix(".part")
            urllib.request.urlretrieve(f"{RELEASE}/{name}", partial)
            partial.rename(path)
    from kokoro_onnx import Kokoro

    return Kokoro(str(CACHE / MODEL_FILES[0]), str(CACHE / MODEL_FILES[1]))


def synth(tts, text, voice, speed):
    samples, rate = tts.create(text, voice=voice, speed=speed, lang="en-us")
    return samples.astype("float32"), rate


def minimax(text, voice, speed, model_name=MINIMAX_MODEL):
    """One line through MiniMax T2A. Returns (mp3 bytes, duration in ms)."""
    key = os.environ.get("MINIMAX_API_KEY")
    if not key:
        sys.exit("MINIMAX_API_KEY isn't set (it's in ~/.zshrc: run through `zsh -ic '…'` or export it)")
    body = {
        "model": model_name,
        "text": text,
        "stream": False,
        "language_boost": "English",
        "voice_setting": {"voice_id": voice, "speed": speed, "vol": 1.0, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "bitrate": MINIMAX_BITRATE, "format": "mp3", "channel": 1},
    }
    request = urllib.request.Request(MINIMAX_URL, data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(4):
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read())
        status = data.get("base_resp", {})
        if status.get("status_code") == 0:
            return bytes.fromhex(data["data"]["audio"]), int(data["extra_info"]["audio_length"])
        if status.get("status_code") in (1002, 1039) and attempt < 3:  # rate limited: back off
            time.sleep(2 ** attempt * 2)
            continue
        sys.exit(f"MiniMax error {status.get('status_code')}: {status.get('status_msg')}")


def write_mp3(samples, rate, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "-", "-b:a", BITRATE, str(out)],
        input=samples.tobytes(),
        check=True,
    )


def load_lexicon():
    path = ROOT / "narration" / "lexicon.json"
    lexicon = json.loads(path.read_text()) if path.exists() else {}
    return lexicon.get("words", {}), [(re.compile(pattern), repl) for pattern, repl in lexicon.get("patterns", [])]


LEXICON = load_lexicon()


def pronounce(text):
    words, patterns = LEXICON
    for term, said in sorted(words.items(), key=lambda item: -len(item[0])):
        text = re.sub(rf"(?<![\w/-]){re.escape(term)}(?![\w/-])", said, text)
    for pattern, repl in patterns:
        text = pattern.sub(repl, text)
    return text


def caption_of(line):
    return line["caption"] if isinstance(line, dict) else line


def spoken(line_id, line):
    caption, text = caption_of(line), line.get("voice") if isinstance(line, dict) else None
    if text is None:
        if re.search(r"\{\w+\}", caption):
            sys.exit(f"{line_id}: caption has placeholders, so it needs a \"voice\" text")
        text = re.sub(r"<[^>]+>", "", caption).replace("&nbsp;", " ")
    return pronounce(text)


def voice_for(script, line):
    speaker = line.get("speaker") if isinstance(line, dict) else None
    if speaker:
        return script["speakers"][speaker]["voice"]
    return script.get("voice", DEFAULT_VOICE)


# Rules from narration/STYLE.md that a script can be checked against. Errors stop a build.
MAX_WORDS = 30
MAX_KEYWORDS = 8
KEYWORD = re.compile(r'<k(?:\s+id="([^"]+)")?>(.*?)</k>', re.S)
REVIEW_LINES = ["keywords.1", "keywords.ask", "keywords.hint", "keywords.done"]


def keyword_id(explicit, inner):
    return explicit or re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>", "", inner).lower()).strip("-")
LESSON_NUMBER = re.compile(r"\b(lesson|lab)s?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", re.I)
LINE_ID = re.compile(r"^[a-z0-9-]+\.[a-z0-9-]+$")


def lint(script):
    errors, warnings = [], []
    speakers = script.get("speakers", {})
    keywords = script.get("keywords", {})
    used = set()
    for word_id, word in keywords.items():
        if not word.get("term") or not word.get("def"):
            errors.append(f"keyword {word_id}: needs a term and a def")
    if len(keywords) > MAX_KEYWORDS:
        warnings.append(f"{len(keywords)} keywords; the lesson budget is {MAX_KEYWORDS}, so split the lesson or drop some")
    if keywords:
        for line_id in REVIEW_LINES:
            if line_id not in script["lines"]:
                errors.append(f"{line_id}: lessons with keywords need this line for the \"Words to keep\" chapter")
    for other in (ROOT / "narration").glob("*.json"):
        if other.name == "lexicon.json":
            continue
        data = json.loads(other.read_text())
        if data.get("lesson") == script.get("lesson"):
            continue
        for word_id in set(keywords) & set(data.get("keywords", {})):
            errors.append(f"keyword {word_id}: also defined by {other.name}; each keyword belongs to one lesson")
    for line_id, line in script["lines"].items():
        caption = caption_of(line)
        said = line.get("voice") if isinstance(line, dict) else None
        plain = re.sub(r"<[^>]+>", "", caption)
        if isinstance(line, dict) and line.get("speaker") and line["speaker"] not in speakers:
            errors.append(f"{line_id}: unknown speaker {line['speaker']!r}")
        for explicit, inner in KEYWORD.findall(caption):
            word_id = keyword_id(explicit, inner)
            used.add(word_id)
            if word_id not in keywords:
                errors.append(f"{line_id}: <k> marks {word_id!r}, which isn't in this script's keywords")
        if re.search(r"\{\w+\}", caption) and not said:
            errors.append(f"{line_id}: caption has placeholders, so it needs a \"voice\" text")
        for text in filter(None, (plain, said)):
            if LESSON_NUMBER.search(text):
                errors.append(f"{line_id}: mentions a lesson or lab number; numbers change when the course is reordered, so name the idea instead")
                break
        if len((said or plain).split()) > MAX_WORDS:
            warnings.append(f"{line_id}: {len((said or plain).split())} words; keep lines to {MAX_WORDS} or split them")
        if not LINE_ID.match(line_id):
            warnings.append(f"{line_id}: ids look like chapter.name (lowercase, digits, dashes)")
    for word_id in set(keywords) - used:
        warnings.append(f"keyword {word_id}: never marked with <k> in a caption, so it only appears in the review chapter")
    return errors, warnings


def cmd_lint(args):
    errors, warnings = lint(json.loads(Path(args.file).read_text()))
    for message in warnings:
        print(f"warning  {message}")
    for message in errors:
        print(f"error    {message}")
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    if errors:
        sys.exit(1)


def line_hash(text, voice, speed, engine="kokoro", model_name=MINIMAX_MODEL):
    # Kokoro's hash is unchanged from before engines existed, so existing audio isn't re-rendered.
    if engine == "minimax":
        return hashlib.sha1(f"minimax|{model_name}|{voice}|{speed}|{MINIMAX_BITRATE}|{text}".encode()).hexdigest()[:12]
    return hashlib.sha1(f"{voice}|{speed}|{BITRATE}|{text}".encode()).hexdigest()[:12]


def cmd_say(args):
    out = Path(args.out) if args.out else Path(tempfile.gettempdir()) / "voice-preview.mp3"
    if args.engine == "minimax":
        audio, _ms = minimax(pronounce(args.text), args.voice if args.voice != DEFAULT_VOICE else "English_SereneWoman", args.speed)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(audio)
    else:
        samples, rate = synth(model(), args.text, args.voice, args.speed)
        write_mp3(samples, rate, out)
    print(out)
    if not args.out:
        subprocess.run(["afplay", str(out)], check=False)


def cmd_voices(args):
    if args.engine == "minimax":
        key = os.environ.get("MINIMAX_API_KEY") or sys.exit("MINIMAX_API_KEY isn't set")
        request = urllib.request.Request("https://api.minimax.io/v1/get_voice", data=b'{"voice_type":"system"}', headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=60) as response:
            for voice in json.loads(response.read()).get("system_voice", []):
                if voice["voice_id"].startswith("English"):
                    print(voice["voice_id"])
        return
    for voice in sorted(model().get_voices()):
        print(voice)


def cmd_build(args):
    script = json.loads(Path(args.file).read_text())
    errors, _warnings = lint(script)
    if errors:
        sys.exit("\n".join(errors) + f"\n{len(errors)} errors; fix them (see lint) before building")
    lesson = script["lesson"]
    lines = {line_id: spoken(line_id, line) for line_id, line in script["lines"].items()}
    voices = {line_id: voice_for(script, line) for line_id, line in script["lines"].items()}
    speed = float(script.get("speed", 1.0))
    engine = script.get("engine", "kokoro")
    model_name = script.get("model", MINIMAX_MODEL)
    hashed = lambda i: line_hash(lines[i], voices[i], speed, engine, model_name)
    folder = ROOT / "audio" / lesson
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    stale = [i for i in lines if manifest.get(i, {}).get("hash") != hashed(i) or not (folder / f"{i}.mp3").exists()]
    tts = model() if stale and engine == "kokoro" else None
    for n, line_id in enumerate(stale, 1):
        if engine == "minimax":
            audio, ms = minimax(lines[line_id], voices[line_id], speed, model_name)
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{line_id}.mp3").write_bytes(audio)
        else:
            samples, rate = synth(tts, lines[line_id], voices[line_id], speed)
            write_mp3(samples, rate, folder / f"{line_id}.mp3")
            ms = round(len(samples) / rate * 1000)
        manifest[line_id] = {"hash": hashed(line_id), "ms": ms}
        print(f"[{n}/{len(stale)}] {line_id}  {manifest[line_id]['ms']} ms")

    for line_id in [i for i in manifest if i not in lines]:
        (folder / f"{line_id}.mp3").unlink(missing_ok=True)
        del manifest[line_id]
        print(f"removed {line_id}")

    folder.mkdir(parents=True, exist_ok=True)
    (folder.parent / "_headers").write_text(HEADERS)
    manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=1) + "\n")
    speakers = {name: {"label": info.get("label", name.title())} for name, info in script.get("speakers", {}).items()}
    bundle = {"lines": script["lines"], "speakers": speakers, "keywords": script.get("keywords", {}), "audio": {i: manifest[i] for i in sorted(manifest)}}
    Path(args.file).with_suffix(".js").write_text(
        f"// Generated by tools/voice.py from {Path(args.file).name}. Edit that file, then rebuild.\n"
        f"window.DataSystemsLab.Narrator.register({json.dumps(lesson)}, {json.dumps(bundle, indent=1)});\n"
    )
    print(f"{len(lines)} lines, {len(stale)} rendered → {folder.relative_to(ROOT)}")


def wrangler(*args, check=True):
    return subprocess.run(["npx", "--yes", "wrangler@4", *args], cwd=ROOT, check=check, text=True, capture_output=not check)


def cmd_deploy(args):
    audio = ROOT / "audio"
    if not any(audio.glob("*/manifest.json")):
        sys.exit("audio/ has no lessons yet; run build first")
    (audio / "_headers").write_text(HEADERS)
    # An assets-only Worker: no script, just files. Flags instead of a wrangler config file, so
    # nothing in the repo can accidentally publish the whole site.
    wrangler("deploy", "--name", args.project, "--assets", str(audio), "--compatibility-date", "2026-09-01")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(required=True)
    say = sub.add_parser("say", help="preview one line")
    say.add_argument("text")
    say.add_argument("--voice", default=DEFAULT_VOICE)
    say.add_argument("--engine", choices=["kokoro", "minimax"], default="kokoro")
    say.add_argument("--speed", type=float, default=1.0)
    say.add_argument("--out", help="save instead of playing")
    say.set_defaults(run=cmd_say)
    voices = sub.add_parser("voices", help="list voice ids")
    voices.add_argument("--engine", choices=["kokoro", "minimax"], default="kokoro")
    voices.set_defaults(run=cmd_voices)
    check = sub.add_parser("lint", help="check a narration file against narration/STYLE.md")
    check.add_argument("file")
    check.set_defaults(run=cmd_lint)
    build = sub.add_parser("build", help="render a narration file")
    build.add_argument("file")
    build.set_defaults(run=cmd_build)
    deploy = sub.add_parser("deploy", help="publish audio/ to Cloudflare")
    deploy.add_argument("--project", default=AUDIO_PROJECT)
    deploy.set_defaults(run=cmd_deploy)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
