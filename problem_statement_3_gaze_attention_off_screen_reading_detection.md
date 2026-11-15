# Problem Statement 3: Gaze & Attention — Off-Screen Reading Detection

## 1. Background & Problem Statement

In remote video interviews and asynchronous recorded video assessments, candidates sometimes read pre-written scripts or live AI-generated answers from a secondary monitor, sticky note, or off-camera browser window. Generic face-detection models fail in real-world conditions because screen sizes, webcam placements, seating distances, and natural head postures vary significantly from person to person.

**Core Question:** *Is the candidate reading off-screen?*

The objective of this challenge is to build a system that detects **off-screen reading behavior during a recorded video answer, calibrated per-person rather than relying on a generic face model**.

---

## 2. Core Components to Build

1. **Per-Person On-Camera Calibration Step:**
   * A brief interactive calibration routine (e.g., following 4–9 screen corner/center targets on camera) that maps an individual's specific gaze angle and eye landmarks to their actual screen boundaries.
2. **Recorded Video Analysis Pass:**
   * An automated processing pipeline that runs across a recorded video answer to track gaze coordinates relative to the calibrated screen bounds and flags **sustained off-screen dwell** (distinguishing brief natural glances from continuous script reading).
3. **Reviewer-Facing Evidence Interface:**
   * A clean UI/dashboard displaying the original video clip alongside an interactive timeline highlighting exact **flagged timestamps**, dwell durations, and confidence indicators so a human reviewer can inspect the evidence.

---

## 3. Real-World Engineering Signals to Reason About

Your architecture and presentation should explicitly account for and reason through real-world computer vision edge cases:

* **Face & Eye Landmark Jitter at Low Light:** Webcams in dimly lit rooms produce noisy landmark coordinates. How do you smooth or filter jitter without masking genuine rapid eye movements (saccades) across lines of text?
* **Head-Pose vs. Eye-Only Movement:** Candidates often keep their head facing forward while scanning text with their eyes alone—or tilt their head naturally while thinking. Your model must combine head-pose vectors (pitch, yaw, roll) with iris/pupil gaze vectors.
* **Calibration Confidence & Failure Handling:** What does "confidence" mean when the calibration step itself is noisy, incomplete, or fails (e.g., glare on glasses, partial face occlusion, or user shifting posture post-calibration)?

---

## 4. Expected Pipeline Architecture

```text
Step 1: Short On-Camera Calibration (Target Points on Screen)
                           │
                           ▼
     Per-Person Gaze-to-Screen Mapping Model / Matrix
                           │
                           ▼
Step 2: Video Answer Ingestion (Frame-by-Frame Extraction)
                           │
                           ▼
  Head-Pose + Iris Landmark Tracking & Temporal Smoothing
                           │
                           ▼
   Sustained Off-Screen Dwell & Reading Pattern Classifier
                           │
                           ▼
Step 3: Reviewer Timeline UI (Timestamped Flags + Confidence Score)
```

---

## 5. Technology Flexibility & Data

* **Approved Stack:** Teams may use any open-source computer vision and ML frameworks such as **MediaPipe (Face Mesh / Iris)**, **OpenCV**, **Dlib**, **PyTorch**, **ONNX**, or browser-based vision libraries (`TensorFlow.js`, `MediaPipe Tasks Vision`).
* **Sample Data:** No video dataset is provided. Teams should record short test clips demonstrating normal speaking behavior versus deliberate off-screen script reading under varied lighting/head-pose conditions.

---

## 6. Minimum Expected Outcome (Acceptance Checklist)

Your live demo and repository submission must demonstrate:
- [ ] A working, short on-camera calibration flow tailored to an individual user.
- [ ] An analysis pass over a recorded video clip that accurately differentiates normal eye movement from sustained off-screen reading dwell.
- [ ] A reviewer-facing interface that displays flagged timestamps synchronized with the original video playback and communicates detection confidence clearly.