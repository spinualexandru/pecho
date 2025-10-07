import { useState, useRef, useCallback } from "react";

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  transcript: string;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  setTranscript: (transcript: string) => void;
  error: string | null;
  isTranscribing: boolean;
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript("");
      setDuration(0);
      audioChunksRef.current = [];

      // Create audio context for mixing
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();

      // Request microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // Connect microphone to destination
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(audioDestination);

      // Request system audio (desktop capture)
      try {
        const systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required for getDisplayMedia, but we'll only use audio
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        systemStreamRef.current = systemStream;

        // Connect system audio to destination
        const audioTracks = systemStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const systemAudioStream = new MediaStream(audioTracks);
          const systemSource =
            audioContext.createMediaStreamSource(systemAudioStream);
          systemSource.connect(audioDestination);
        }

        // Stop video track immediately (we only need audio)
        const videoTracks = systemStream.getVideoTracks();
        videoTracks.forEach((track) => track.stop());
      } catch (displayErr) {
        console.warn(
          "System audio capture failed, continuing with microphone only:",
          displayErr,
        );
        setError(
          "Note: Only capturing microphone. System audio capture was declined.",
        );
      }

      // Use the mixed stream for recording
      const mixedStream = audioDestination.stream;
      mixedStreamRef.current = mixedStream;

      // Set up MediaRecorder for the mixed audio
      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await processAudioBlob(audioBlob);
      };

      mediaRecorder.start(1000); // Collect data every second

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      console.error("Recording error:", err);
    }
  }, []);

  const processAudioBlob = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      setError(null);

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get audio channel data (mono)
      const channelData = audioBuffer.getChannelData(0);

      // Send to main process for transcription
      const transcriptText = await window.recording.transcribeAudio(
        channelData.buffer,
      );

      setTranscript(transcriptText);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to transcribe audio";
      setError(errorMessage);
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  };

  const stopRecording = useCallback(async () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop all tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((track) => track.stop());
      systemStreamRef.current = null;
    }

    if (mixedStreamRef.current) {
      mixedStreamRef.current.getTracks().forEach((track) => track.stop());
      mixedStreamRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  return {
    isRecording,
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
