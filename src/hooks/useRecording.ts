import type { TranslationKey } from "@/localization/i18n";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getWhisperModel } from "@/helpers/whisper-helpers";
import { getTranscriberLanguage } from "@/helpers/language-helpers";

interface RecordingError {
  message: TranslationKey;
  detail?: string;
}
interface Capture {
  streams: MediaStream[];
  context: AudioContext;
  recorder?: MediaRecorder;
  timer?: ReturnType<typeof setInterval>;
  chunks: Blob[];
}
function release(capture: Capture) {
  clearInterval(capture.timer);
  capture.streams.forEach((stream) =>
    stream.getTracks().forEach((track) => track.stop()),
  );
  capture.streams = [];
  if (capture.context.state !== "closed")
    void capture.context.close().catch(() => {});
}

interface CaptureState {
  captureRef: RefObject<Capture | null>;
  decodeRef: RefObject<AudioContext | null>;
  busyRef: RefObject<boolean>;
  epoch: RefObject<number>;
  setIsStarting: Dispatch<SetStateAction<boolean>>;
  setHasSystemAudio: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<RecordingError | null>>;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  setIsTranscribing: Dispatch<SetStateAction<boolean>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  setDuration: Dispatch<SetStateAction<number>>;
}

// Media capture is imperative: keep resource ownership and its finally blocks
// outside the hook so the compiler can optimize React's state and callbacks.
async function startCapture({
  captureRef,
  decodeRef,
  busyRef,
  epoch,
  setIsStarting,
  setHasSystemAudio,
  setError,
  setIsRecording,
  setIsPaused,
  setIsTranscribing,
  setTranscript,
  setDuration,
}: CaptureState) {
  // React state alone cannot guard two clicks before the next render.
  if (busyRef.current) return;
  busyRef.current = true;
  const operation = ++epoch.current;
  const current = () => epoch.current === operation;
  const preferences = {
    model: getWhisperModel(),
    language: getTranscriberLanguage(),
  };
  setIsStarting(true);
  setHasSystemAudio(false);
  setError(null);
  let capture: Capture | undefined;
  try {
    const context = new AudioContext();
    capture = { context, streams: [], chunks: [] };
    captureRef.current = capture;
    const destination = context.createMediaStreamDestination();
    capture.streams.push(destination.stream);
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    capture.streams.push(mic);
    if (!current()) {
      release(capture);
      return;
    }
    context.createMediaStreamSource(mic).connect(destination);
    try {
      const system = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      capture.streams.push(system);
      if (!current()) {
        release(capture);
        return;
      }
      setHasSystemAudio(system.getAudioTracks().length > 0);
      if (system.getAudioTracks().length)
        context
          .createMediaStreamSource(new MediaStream(system.getAudioTracks()))
          .connect(destination);
      system.getVideoTracks().forEach((track) => track.stop());
    } catch {
      if (!current()) return;
      setError({
        message:
          "Note: Only capturing microphone. System audio capture was declined.",
      });
    }
    if (!current()) return;
    const owned = capture;
    const recorder = new MediaRecorder(destination.stream, {
      mimeType: "audio/webm",
    });
    owned.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) owned.chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (!current()) return;
      epoch.current++;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release(owned);
      captureRef.current = null;
      busyRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
      setIsTranscribing(false);
      setError({
        message: "Could not start recording. Check microphone access.",
      });
    };
    recorder.onstop = async () => {
      release(owned);
      if (!current()) return;
      captureRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setIsTranscribing(true);
      let decoder: AudioContext | undefined;
      try {
        decoder = new AudioContext({ sampleRate: 16000 });
        decodeRef.current = decoder;
        const bytes = await new Blob(owned.chunks, {
          type: "audio/webm",
        }).arrayBuffer();
        if (!current()) return;
        const audio = await decoder.decodeAudioData(bytes);
        if (!current()) return;
        const result = await window.recording.transcribeAudio(
          new Float32Array(audio.getChannelData(0)).buffer,
          preferences.model,
          preferences.language,
        );
        if (current()) setTranscript(result);
      } catch (err) {
        if (current())
          setError({
            message:
              "Could not transcribe audio. Check the model and language in Settings, then retry.",
            detail: String(err),
          });
      } finally {
        if (decoder && decoder.state !== "closed")
          await decoder.close().catch(() => {});
        if (decodeRef.current === decoder) decodeRef.current = null;
        if (current()) {
          busyRef.current = false;
          setIsTranscribing(false);
        }
      }
    };
    recorder.start(1000);
    owned.timer = setInterval(() => setDuration((value) => value + 1), 1000);
    setTranscript("");
    setDuration(0);
    setIsRecording(true);
    setIsPaused(false);
  } catch (err) {
    if (capture) release(capture);
    if (current()) {
      captureRef.current = null;
      busyRef.current = false;
      setError({
        message: "Could not start recording. Check microphone access.",
        detail: String(err),
      });
    }
  } finally {
    if (current()) setIsStarting(false);
  }
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<RecordingError | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const decodeRef = useRef<AudioContext | null>(null);
  const busyRef = useRef(false);
  const epoch = useRef(0);

  useEffect(
    () => () => {
      epoch.current++;
      busyRef.current = false;
      const capture = captureRef.current;
      captureRef.current = null;
      if (capture) {
        if (capture.recorder) {
          capture.recorder.onstop = null;
          capture.recorder.ondataavailable = null;
          capture.recorder.onerror = null;
          if (capture.recorder.state !== "inactive") capture.recorder.stop();
        }
        release(capture);
      }
      const decoder = decodeRef.current;
      decodeRef.current = null;
      if (decoder && decoder.state !== "closed")
        void decoder.close().catch(() => {});
    },
    [],
  );

  const startRecording = useCallback(
    () =>
      startCapture({
        captureRef,
        decodeRef,
        busyRef,
        epoch,
        setIsStarting,
        setHasSystemAudio,
        setError,
        setIsRecording,
        setIsPaused,
        setIsTranscribing,
        setTranscript,
        setDuration,
      }),
    [],
  );

  const stopRecording = useCallback(() => {
    const capture = captureRef.current;
    if (!capture?.recorder || capture.recorder.state === "inactive") return;
    // The busy guard stays held until transcription settles.
    setIsTranscribing(true);
    setIsRecording(false);
    setIsPaused(false);
    capture.recorder.stop();
    release(capture);
  }, []);
  const pauseRecording = useCallback(() => {
    const capture = captureRef.current;
    if (capture?.recorder?.state !== "recording") return;
    capture.recorder.pause();
    clearInterval(capture.timer);
    setIsPaused(true);
  }, []);
  const resumeRecording = useCallback(() => {
    const capture = captureRef.current;
    if (capture?.recorder?.state !== "paused") return;
    capture.recorder.resume();
    capture.timer = setInterval(() => setDuration((value) => value + 1), 1000);
    setIsPaused(false);
  }, []);
  return {
    isRecording,
    hasSystemAudio,
    isStarting,
    isPaused,
    transcript,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    setTranscript,
    error,
    isTranscribing,
  };
}
