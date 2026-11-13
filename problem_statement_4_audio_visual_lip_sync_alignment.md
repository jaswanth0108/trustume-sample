# Problem Statement 4: Audio-Visual Lip-Sync Alignment

## 1. Background & Problem Statement

Remote interview integrity can be compromised when spoken audio does not match the video feed on screen—a common indicator of live voice dubbing by a proxy speaker, pre-recorded video playback looped into a virtual camera, or real-time synthetic face-swapping.

**Core Question:** *Does the mouth match the voice?*

The objective of this challenge is to build an audio-visual forensic pipeline that **detects misalignment between spoken audio and lip movement** in video interview recordings and surfaces clear, timestamped evidence for reviewers.

---

## 2. Core Components to Build

1. **Synchronized Audio-Visual Feature Extraction Pass:**
   * Extract lip/mouth landmarks (e.g., outer/inner lip contours, mouth aperture/aspect ratio, jaw movement) frame-by-frame in tight temporal alignment with the extracted audio track.
2. **Phoneme-to-Viseme Correlation & Offset Scoring:**
   * Compute a correlation score or temporal offset metric (in milliseconds/frames) comparing spoken audio energy/phoneme timing (e.g., bilabial plosives like `/p/`, `/b/`, `/m/` requiring mouth closure, vs. open vowels) against observed mouth shapes.
3. **Flagged-Segment Reviewer View:**
   * A reviewer-facing interface displaying the video clip alongside a timeline/waveform view highlighting exact segments where audio-visual sync breaks down, by how much (offset duration or anomaly score), and why.

---

## 3. Real-World Engineering Signals to Reason About

Your solution and presentation should thoughtfully address real-world signal processing challenges:

* **Natural A/V Drift vs. Genuine Tampering:** WebRTC calls, Bluetooth headsets, and video transcoding routinely introduce a constant 50–150 ms audio-video offset or brief network jitter. How do you distinguish uniform encoding latency from localized, non-uniform lip-sync breakdown?
* **Low Frame-Rate Video Feeds:** Many candidates interview on budget webcams or throttled connections running at 10–15 FPS, where fast syllables occur between frames. How does your pipeline maintain reliability under low temporal resolution?
* **Accent, Speech Rate & Speech Impediment Fairness:** Setting overly aggressive thresholds can unfairly penalize non-native accents, fast talkers, facial hair, or speech impediments. How do you calibrate thresholds to minimize false positives?

---

## 4. Expected Pipeline Architecture

```text
Recorded Video Input (.mp4 / .webm)
         │
         ├───────────────────────────────┐
         ▼                               ▼
Video Frame Extraction            Audio Track Extraction
(MediaPipe / OpenCV Lip Mesh)     (Librosa / Whisper / WebRTC VAD)
         │                               │
         ▼                               ▼
Mouth Aperture & Viseme Sequence  Phoneme / Speech Envelope Timing
         │                               │
         └───────────────┬───────────────┘
                         ▼
       Cross-Correlation & Temporal Offset Engine
         (Global Drift Compensation vs. Local Anomaly)
                         │
                         ▼
   Reviewer Dashboard (Flagged Segments, Offset Metrics & Video Sync)
```

---

## 5. Technology Flexibility & Data

* **Approved Stack:** Teams are free to use any open-source audio, vision, or pre-trained sync models such as **MediaPipe**, **OpenCV**, **Librosa**, **FFmpeg**, **Whisper / Wav2Vec2** (for phoneme/speech alignment), **SyncNet** derivatives, or custom signal correlation algorithms.
* **Sample Data:** No dataset is provided. Teams should generate test videos containing: (a) genuine unedited speech, (b) manually shifted/dubbed audio tracks, and (c) mismatched voice-over clips to validate detection sensitivity and false-positive control.

---

## 6. Minimum Expected Outcome (Acceptance Checklist)

Your live demo and repository submission must demonstrate:
- [ ] Extraction of mouth/lip movement metrics synchronized with the video's audio track.
- [ ] A correlation or temporal offset scoring mechanism that detects where spoken phonemes diverge from visual mouth movements.
- [ ] A reviewer-facing view highlighting flagged segments on a timeline with measurable sync breakdown metrics alongside the video clip.