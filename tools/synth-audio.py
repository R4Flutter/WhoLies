"""
Builds the game's built-in sound effects and background music from scratch
(no samples, no API). Output: assets/audio/*.mp3

Needs: python3 with numpy + scipy, and ffmpeg.
    python3 tools/synth-audio.py

To replace these with AI-generated sounds, use tools/elevenlabs-audio.mjs instead.
It writes files with the same names, so the game picks them up automatically.
"""
import os, subprocess, tempfile
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1955)


# ---------- helpers ----------
def T(d): return np.arange(int(SR * d)) / SR
def noise(n): return rng.standard_normal(n)
def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)
def lp(x, f, o=2): return filt(x, "low", f, o)
def hp(x, f, o=2): return filt(x, "high", f, o)
def bp(x, lo, hi, o=2): return filt(x, "band", [lo, hi], o)
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def fade(x, a=0.002, r=0.01):
    x = x.copy(); na, nr = int(SR * a), int(SR * r)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nr: x[-nr:] *= np.linspace(1, 0, nr)
    return x
def place(buf, x, t, gain=1.0, ch=None, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1]: return
    x = x[: buf.shape[1] - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(x)] += x * gain * l * 1.4142
    buf[1, i:i + len(x)] += x * gain * r * 1.4142
def reverb_ir(dur=1.8, tau=0.45, bright=5000):
    t = T(dur)
    l = lp(noise(len(t)), bright) * np.exp(-t / tau)
    r = lp(noise(len(t)), bright) * np.exp(-t / tau)
    l[: int(0.012 * SR)] = 0; r[: int(0.017 * SR)] = 0
    return np.stack([l, r]) / np.sqrt(np.sum(l ** 2))
def reverb(st, wet=0.25, **kw):
    ir = reverb_ir(**kw)
    n = st.shape[1]
    out = np.stack([fftconvolve(st[0], ir[0])[:n], fftconvolve(st[1], ir[1])[:n]])
    return st * (1 - wet * 0.4) + out * wet
def mono_to_st(x): return np.stack([x, x])
def save(name, x, peak_db=-1.0, bitrate="128k", stereo=True):
    if x.ndim == 1: x = mono_to_st(x)
    x = x / (np.max(np.abs(x)) + 1e-9) * (10 ** (peak_db / 20))
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wavfile.write(f.name, SR, (x.T * 32767).astype(np.int16))
        tmp = f.name
    dst = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "2" if stereo else "1",
                    "-codec:a", "libmp3lame", "-b:a", bitrate, dst], check=True)
    os.unlink(tmp)
    print(f"{name}.mp3  {x.shape[1] / SR:5.2f}s  {os.path.getsize(dst) // 1024} KB")


# ---------- instruments ----------
def vibe(m, d=1.6, bright=1.0):
    f, t = mtof(m), T(d)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1)
         + 0.22 * bright * np.sin(2 * np.pi * 4.0 * f * t) * np.exp(-t / 0.16)
         + 0.06 * bright * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t / 0.04))
    x *= 1 + 0.18 * np.sin(2 * np.pi * 5.2 * t)  # motor tremolo
    return fade(x, 0.003, 0.08)

def bass(m, d=0.7):
    f, t = mtof(m), T(d)
    x = sum((1 / k ** 1.25) * np.sin(2 * np.pi * k * f * t + k) * np.exp(-t / (0.42 / k ** 0.6)) for k in range(1, 7))
    x += 0.25 * lp(noise(len(t)), 900) * np.exp(-t / 0.012)   # finger thump
    return fade(lp(x, 1400), 0.004, 0.06)

def ride(d=1.4):
    t = T(d)
    x = lp(hp(noise(len(t)), 5000), 11000) * np.exp(-t / 0.22) * 0.5
    for fr, a in ((3170, .05), (4710, .04), (6920, .03), (5530, .03), (7810, .02)):
        fr *= rng.uniform(0.97, 1.03)
        x += a * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t / 0.3)
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x

def brush_tap(d=0.18):
    t = T(d)
    return bp(noise(len(t)), 900, 6000) * np.exp(-t / 0.035)

def brush_swish(d):
    t = T(d)
    env = np.sin(np.pi * t / d) ** 1.5
    return bp(noise(len(t)), 1200, 5000) * env * 0.35

def piano(m, d=2.5):
    f, t = mtof(m), T(d)
    x = sum((1 / k) * np.sin(2 * np.pi * k * f * (1 + 0.0004 * k * k) * t) * np.exp(-t / (1.6 / k)) for k in range(1, 10))
    return fade(x, 0.002, 0.2)

def saw_swell(m, d, detune=0.006):
    t = T(d); x = np.zeros(len(t))
    for dt in (-detune, 0, detune):
        f = mtof(m) * (1 + dt)
        x += sum(np.sin(2 * np.pi * k * f * t) / k for k in range(1, 14))
    return x


# ---------- sound effects ----------
def sfx():
    # tap: pencil tick on paper
    t = T(0.08)
    x = hp(noise(len(t)), 2500) * np.exp(-t / 0.005) * 0.6 + (np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.012)) * 0.4
    save("tap", fade(x, 0.0005, 0.01), peak_db=-6, bitrate="96k")

    # stamp: rubber stamp slammed on a desk
    t = T(0.5)
    f = 62 + 70 * np.exp(-t / 0.022)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    slap = lp(noise(len(t)), 2400) * np.exp(-t / 0.016)
    paper = bp(noise(len(t)), 1800, 6000) * np.exp(-t / 0.05) * 0.18
    st = reverb(mono_to_st(thump * 1.0 + slap * 0.9 + paper), wet=0.18, dur=0.5, tau=0.12, bright=4000)
    save("stamp", st, peak_db=-2, bitrate="96k")

    # correct: two vibraphone notes rising (case solved)
    st = np.zeros((2, int(SR * 1.8)))
    place(st, vibe(76, 1.6), 0.0, 0.7, pan=-0.2)
    place(st, vibe(81, 1.6), 0.11, 0.8, pan=0.2)
    place(st, vibe(88, 1.2, 0.6), 0.22, 0.25, pan=0.3)
    save("correct", reverb(st, 0.3), peak_db=-3)

    # wrong: low muted horn falling a half step
    st = np.zeros((2, int(SR * 1.0)))
    for i, (m, d) in enumerate(((50, 0.22), (49, 0.6))):
        t = T(d)
        f = mtof(m) * (1 - (0.03 * t / d if i else 0))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = sum(np.sin(k * ph) / k for k in range(1, 12))
        x = lp(x, 900) * (1 - np.exp(-t / 0.01)) * np.exp(-t / (0.5 if i else 0.15))
        place(st, fade(x, 0.005, 0.05), 0.0 if i == 0 else 0.2, 0.9)
    save("wrong", reverb(st, 0.2), peak_db=-3)

    # tick: clock tick
    t = T(0.05)
    x = hp(noise(len(t)), 3000) * np.exp(-t / 0.003) + 0.5 * np.sin(2 * np.pi * 3300 * t) * np.exp(-t / 0.006)
    save("tick", fade(x, 0.0003, 0.005), peak_db=-8, bitrate="96k")

    # timeout: old alarm bell ringing
    st = np.zeros((2, int(SR * 1.2)))
    for k in range(10):
        t = T(0.9)
        x = sum(a * np.sin(2 * np.pi * 1180 * r * t) * np.exp(-t / (0.35 / r)) for r, a in ((1, 1), (2.76, .5), (5.4, .25)))
        x += hp(noise(len(t)), 4000) * np.exp(-t / 0.004) * 0.4
        place(st, x, k * 0.055, 0.5, pan=0.15 * (-1) ** k)
    save("timeout", reverb(st, 0.15), peak_db=-4)

    # twist: piano hit in the low register + tense string swell
    st = np.zeros((2, int(SR * 2.4)))
    place(st, piano(33, 2.3) + piano(45, 2.3) * 0.8 + piano(46, 2.3) * 0.35, 0.0, 0.9)
    d = 1.05; t = T(d)
    sw = saw_swell(57, d) + saw_swell(63, d) * 0.8  # A3 + Eb4: a tritone
    sw = lp(sw, 2500) * (t / d) ** 2.2
    sw[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    place(st, sw * 0.12, 0.12, 1.0, pan=0.0)
    place(st, piano(57, 1.2) + piano(63, 1.2), 1.17, 0.5)
    save("twist", reverb(st, 0.35, dur=2.2, tau=0.6), peak_db=-3)

    # fanfare: jazzy "case closed" (good result)
    st = np.zeros((2, int(SR * 2.6)))
    place(st, bass(45, 1.2), 0.0, 1.0)
    for i, m in enumerate((69, 72, 76, 79, 83)):
        place(st, vibe(m, 2.0), 0.07 * i, 0.55, pan=-0.4 + 0.2 * i)
    place(st, ride(1.8), 0.0, 0.25, pan=0.5)
    place(st, vibe(88, 1.8, 0.5), 0.42, 0.3, pan=0.4)
    save("fanfare", reverb(st, 0.3), peak_db=-3)

    # fail: slow falling notes (bad result)
    st = np.zeros((2, int(SR * 2.6)))
    place(st, bass(41, 1.6), 0.0, 0.9)
    for i, m in enumerate((76, 72, 69, 65)):
        place(st, vibe(m, 1.6), 0.24 * i, 0.5, pan=0.3 - 0.2 * i)
    save("fail", reverb(st, 0.3), peak_db=-4)

    # whoosh: a case file sliding across the desk
    d = 0.4; t = T(d)
    env = np.sin(np.pi * t / d) ** 2
    lo = 700 + 2200 * t / d
    x = np.zeros(len(t)); n = noise(len(t))
    seg = 400
    for i in range(0, len(t), seg):
        c = lo[i]; x[i:i + seg] = bp(n[max(0, i - 2000):i + seg], c * 0.6, min(c * 1.8, 16000))[-len(n[i:i + seg]):]
    save("whoosh", fade(x * env, 0.005, 0.02), peak_db=-9, bitrate="96k")


# ---------- game-feel effects (rewards, menus) ----------
def sfx_rewards():
    # coin: two bright bell pings
    st = np.zeros((2, int(SR * 0.6)))
    for i, m in enumerate((88, 95)):
        t = T(0.5); f = mtof(m)
        x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t)) * np.exp(-t / 0.12)
        place(st, fade(x, 0.001, 0.05), 0.06 * i, 0.6, pan=-0.2 + 0.4 * i)
    save("coin", reverb(st, 0.12, dur=0.6, tau=0.15), peak_db=-5, bitrate="96k")

    # star: one sparkling vibraphone ping (the game raises its pitch for stars 2 and 3)
    st = np.zeros((2, int(SR * 1.2)))
    place(st, vibe(84, 1.0), 0.0, 0.8)
    t = T(0.4)
    sparkle = hp(noise(len(t)), 7000) * np.exp(-t / 0.05) * 0.25
    place(st, sparkle, 0.0, 0.5, pan=0.3)
    save("star", reverb(st, 0.25), peak_db=-4, bitrate="96k")

    # levelup: rising arpeggio with a soft cymbal
    st = np.zeros((2, int(SR * 2.2)))
    for i, m in enumerate((69, 73, 76, 81, 85, 88)):
        place(st, vibe(m, 1.4), 0.075 * i, 0.5, pan=-0.5 + 0.2 * i)
    place(st, bass(45, 1.0), 0.0, 0.8)
    place(st, ride(1.6), 0.42, 0.25, pan=0.4)
    save("levelup", reverb(st, 0.3), peak_db=-3)

    # combo: short upward blip
    t = T(0.18)
    f = 600 + 900 * (t / 0.18)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08)
    save("combo", fade(x, 0.002, 0.03), peak_db=-8, bitrate="96k")

    # click: soft menu click
    t = T(0.05)
    x = lp(hp(noise(len(t)), 1200), 5000) * np.exp(-t / 0.004) + 0.4 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.01)
    save("click", fade(x, 0.0005, 0.005), peak_db=-10, bitrate="96k")

    # buy: cash drawer + coin
    st = np.zeros((2, int(SR * 0.8)))
    t = T(0.25)
    drawer = bp(noise(len(t)), 300, 2500) * np.exp(-t / 0.05)
    place(st, drawer, 0.0, 0.7)
    bell = np.sin(2 * np.pi * 2093 * T(0.6)) * np.exp(-T(0.6) / 0.18)
    place(st, bell, 0.1, 0.5)
    save("buy", reverb(st, 0.15, dur=0.6, tau=0.15), peak_db=-5, bitrate="96k")

    # achieve: warm three-note chord bloom
    st = np.zeros((2, int(SR * 1.9)))
    for i, m in enumerate((72, 76, 79, 84)):
        place(st, vibe(m, 1.7, 0.8), 0.04 * i, 0.45, pan=-0.3 + 0.2 * i)
    place(st, bass(48, 1.0), 0.0, 0.7)
    save("achieve", reverb(st, 0.3), peak_db=-3)


# ---------- background music: slow noir jazz, 16 bars, seamless loop ----------
def music():
    bpm = 84.0
    beat = 60 / bpm; bar = 4 * beat
    bars = 16; P = bars * bar; XF = 1.5
    total = 2 * P + XF + 3
    st = np.zeros((2, int(SR * total)))
    # (root midi, quality, vibe voicing)
    A, D, Bb7, E7, F = ((45, "m"), (50, "m"), (47, "h"), (40, "d"), (41, "M"))
    voic = {"m45": (55, 59, 60, 64), "m50": (53, 57, 60, 64), "h47": (57, 62, 65), "d40": (56, 62, 65, 71), "M41": (57, 60, 64, 67)}
    prog = [A, A, D, D, Bb7, E7, A, A, F, F, D, E7, A, F, Bb7, E7]
    iv = {"m": (0, 3, 7, 10), "d": (0, 4, 7, 10), "h": (0, 3, 6, 10), "M": (0, 4, 7, 11)}
    melody = {2: [(0, 76, 1.0), (1.67, 74, 0.33), (2, 72, 2.0)], 3: [(0, 69, 3.5)],
              6: [(0, 79, 0.67), (0.67, 76, 0.33), (1, 74, 1.0), (2, 76, 2.0)], 7: [(1, 72, 0.67), (1.67, 69, 2.3)],
              10: [(0, 77, 1.0), (1, 76, 0.67), (1.67, 74, 0.33), (2, 72, 2.0)], 11: [(0, 71, 1.0), (1, 68, 3.0)],
              14: [(0, 74, 1.0), (1, 72, 1.0), (2, 71, 2.0)], 15: [(0, 68, 2.0), (2, 71, 1.5)]}
    for loop in range(3):
        for b in range(bars):
            t0 = loop * P + b * bar
            if t0 > total - 0.5: break
            root, q = prog[b]
            nroot = prog[(b + 1) % bars][0]
            ints = iv[q]
            line = [root, root + ints[1], root + ints[2], nroot + (1 if (b % 2) else -1)]
            line = [n + 12 if n < 38 else (n - 12 if n > 57 else n) for n in line]
            for k, n in enumerate(line):  # walking bass
                place(st, bass(n, beat * 1.05), t0 + k * beat, 0.95 if k == 0 else 0.8, pan=0.0)
            for k in range(4):  # ride: ding, ding-ga, ding, ding-ga
                place(st, ride(), t0 + k * beat, 0.13 if k % 2 else 0.1, pan=0.45)
                if k % 2: place(st, ride(0.6), t0 + k * beat + beat * 2 / 3, 0.07, pan=0.45)
                place(st, brush_swish(beat), t0 + k * beat, 0.22, pan=-0.35)
                if k % 2: place(st, brush_tap(), t0 + k * beat, 0.28, pan=-0.3)
            key = f"{q}{root}"
            hits = [(0.0, 1.4)] if b % 2 == 0 else [(0.0, 1.0), (2.67, 1.2)]
            for off, dur in hits:  # comping chords
                for j, m in enumerate(voic[key]):
                    place(st, vibe(m, beat * dur * 2.2, 0.7), t0 + off * beat + 0.012 * j, 0.16, pan=-0.25 + 0.17 * j)
            for off, m, dur in melody.get(b, []):  # sparse vibraphone melody
                place(st, vibe(m, max(1.2, beat * dur * 1.6)), t0 + off * beat, 0.38, pan=0.15)
    st = reverb(st, wet=0.32, dur=2.4, tau=0.7, bright=4500)
    st = np.stack([lp(st[0], 10000), lp(st[1], 10000)])  # warmer top end
    seg = st[:, int(P * SR): int((2 * P + XF) * SR)]  # second pass: carries the tails, loops cleanly
    save("music", seg, peak_db=-3, bitrate="112k")


if __name__ == "__main__":
    import sys
    if "--rewards-only" in sys.argv:
        sfx_rewards()
    else:
        if "--music-only" not in sys.argv:
            sfx()
            sfx_rewards()
        music()
