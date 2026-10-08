"""Package openly licensed recordings. Run with Python 3 and ffmpeg on PATH.
All network URLs are fixed public asset downloads; only local MP3s are shipped.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.tmp' / 'sound-source'
OUTPUT = ROOT / 'frontend' / 'public' / 'assets' / 'library-sounds'
FILES = [
    dict(id='rain', original='rain.zip', url='https://opengameart.org/sites/default/files/Rain%20OGG.zip', title='Rain (loopable)', author='Ylmir', page='https://opengameart.org/content/rain-loopable', license='CC0', duration=30),
    dict(id='fire', original='fire.wav', url='https://opengameart.org/sites/default/files/fire.wav', title='Fireplace Sound loop', author='PagDev', page='https://opengameart.org/content/fireplace-sound-loop', license='CC0', duration=30),
    dict(id='birds', original='birds.ogg', url='https://opengameart.org/sites/default/files/birds-isaiah658_0.ogg', title='Ambient Bird Sounds', author='isaiah658', page='https://opengameart.org/content/ambient-bird-sounds', license='CC0', duration=30),
    dict(id='ocean', original='ocean.flac', url='https://opengameart.org/sites/default/files/wave_01_cc0-18363__jasinski__alkaibeach.flac', title='Beach Ocean Waves', author='jasinski (submitted by qubodup)', page='https://opengameart.org/content/beach-ocean-waves', license='CC0', duration=30),
    dict(id='night', original='night.mp3', url='https://opengameart.org/sites/default/files/crickets_1.mp3', title='Crickets Ambient Noise - loopable', author='Ted Kerr / Wolfgang_', page='https://opengameart.org/content/crickets-ambient-noise-loopable', license='CC0', duration=11),
    dict(id='pages', original='pages.wav', url='https://opengameart.org/sites/default/files/Page%20Turning%20Sfx.wav', title='Page Turning Sfx Sound Effect', author='Nicole Marie T', page='https://opengameart.org/content/page-turning-sfx-sound-effect', license='CC-BY 4.0', duration=3),
]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def download(asset):
    target = SOURCE / asset['original']
    if not target.exists():
        with urllib.request.urlopen(asset['url'], timeout=60) as response:
            data = response.read(24 * 1024 * 1024)
            if len(data) >= 24 * 1024 * 1024:
                raise ValueError('Unexpectedly large recording')
            target.write_bytes(data)
    print(f"{asset['id']}: source {target.stat().st_size} bytes", flush=True)
def main():
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    if not ffmpeg:
        raise RuntimeError('Install ffmpeg and add it to PATH before running.')
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, FILES))
    with zipfile.ZipFile(SOURCE / 'rain.zip') as archive:
        entries = sorted(name for name in archive.namelist() if name.endswith('.ogg'))
        print('Rain variants:', entries)
        rain = SOURCE / 'rain-original.ogg'
        rain.write_bytes(archive.read(entries[0]))
    manifest = []
    for asset in FILES:
        source = rain if asset['id'] == 'rain' else SOURCE / asset['original']
        destination = OUTPUT / f"{asset['id']}.mp3"
        # Mono lets the browser construct width using independent stereo positions.
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '2', '-i', str(source), '-t', str(asset['duration']), '-af', 'highpass=f=35,lowpass=f=11000,loudnorm=I=-23:TP=-5:LRA=8', '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '112k', '-map_metadata', '-1', str(destination)], check=True)
        duration = float(subprocess.check_output([ffprobe,'-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(destination)], text=True))
        manifest.append({**asset, 'duration': duration, 'license_url': 'https://creativecommons.org/publicdomain/zero/1.0/' if asset['license']=='CC0' else 'https://creativecommons.org/licenses/by/4.0/', 'modifications': 'Trimmed, mono downmix, frequency filtering, loudness normalization, MP3 conversion; loop seams blended on playback.', 'source_sha256': digest(SOURCE / asset['original']), 'file': destination.name, 'sha256': digest(destination), 'bytes': destination.stat().st_size})
        print(f"{asset['id']}: packaged {destination.stat().st_size} bytes", flush=True)
    (OUTPUT / 'sources.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
if __name__ == '__main__':
    main()
