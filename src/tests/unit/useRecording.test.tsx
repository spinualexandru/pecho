import { useEffect } from "react";
import { MeetingProvider, useMeeting } from "@/providers/MeetingProvider";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useRecording } from "@/hooks/useRecording";
const tracks: { stop: ReturnType<typeof vi.fn> }[] = [];
const contexts: FakeContext[] = [];
const recorders: FakeRecorder[] = [];
function stream() {
  const track = { stop: vi.fn() };
  tracks.push(track);
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
}
class FakeContext {
  state = "running";
  close = vi.fn(async () => {
    this.state = "closed";
  });
  constructor() {
    contexts.push(this);
  }
  createMediaStreamDestination() {
    return { stream: stream() };
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  decodeAudioData = vi.fn(async () => ({
    getChannelData: () => new Float32Array([0, 0.1]),
  }));
}
class FakeRecorder {
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor() {
    recorders.push(this);
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    queueMicrotask(() => this.onstop?.());
  });
}
beforeEach(() => {
  tracks.length = 0;
  contexts.length = 0;
  recorders.length = 0;
  localStorage.clear();
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  // jsdom Blob does not implement arrayBuffer.
  vi.spyOn(Blob.prototype, "arrayBuffer").mockResolvedValue(new ArrayBuffer(4));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => stream()),
      getDisplayMedia: vi.fn(async () => {
        throw new Error("declined");
      }),
    },
  });
  window.recording = {
    transcribeAudio: vi.fn(async () => "meeting transcript"),
    onSummaryEvent: vi.fn(() => () => {}),
    cancelSummary: vi.fn(async () => {}),
  } as unknown as RecordingContext;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("serializes double starts/stops and releases mixing/decoding contexts and tracks", async () => {
  const { result, unmount } = renderHook(useRecording);
  await act(async () => {
    await Promise.all([
      result.current.startRecording(),
      result.current.startRecording(),
    ]);
  });
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(result.current.isRecording).toBe(true);
  await act(async () => {
    await Promise.all([
      result.current.stopRecording(),
      result.current.stopRecording(),
    ]);
  });
  await waitFor(() =>
    expect(result.current.transcript).toBe("meeting transcript"),
  );
  expect(recorders[0].stop).toHaveBeenCalledTimes(1);
  expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(
    true,
  );
  expect(
    contexts.every((context) => context.close.mock.calls.length === 1),
  ).toBe(true);
  unmount();
});
it("releases allocated resources on microphone denial and can retry", async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
    new Error("denied"),
  );
  const { result } = renderHook(useRecording);
  await act(() => result.current.startRecording());
  expect(result.current.isStarting).toBe(false);
  expect(contexts[0].close).toHaveBeenCalledOnce();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  await act(() => result.current.startRecording());
  expect(result.current.isRecording).toBe(true);
});
it("stops a late microphone stream after provider unmount without starting capture", async () => {
  let resolve!: (value: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, unmount } = renderHook(useRecording);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.startRecording();
  });
  unmount();
  const late = stream();
  await act(async () => {
    resolve(late);
    await pending;
  });
  expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(
    true,
  );
  expect(recorders).toHaveLength(0);
  expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
});
it("provider unmount stops active recording without submitting transcription", async () => {
  const { result, unmount } = renderHook(useRecording);
  await act(() => result.current.startRecording());
  unmount();
  await act(async () => {});
  expect(recorders[0].stop).toHaveBeenCalledOnce();
  expect(window.recording.transcribeAudio).not.toHaveBeenCalled();
  expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(
    true,
  );
});
it("retains the previous transcript when starting capture fails", async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
    new Error("denied"),
  );
  const { result } = renderHook(useRecording);
  act(() => result.current.setTranscript("Previous meeting"));
  await act(() => result.current.startRecording());
  expect(result.current.transcript).toBe("Previous meeting");
  expect(result.current.error).not.toBeNull();
});

it("keeps pending transcription and draft when the route consumer unmounts", async () => {
  let finish!: (text: string) => void;
  vi.mocked(window.recording.transcribeAudio).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let meeting!: ReturnType<typeof useMeeting>;
  function Home() {
    const state = useMeeting();
    useEffect(() => {
      meeting = state;
    }, [state]);
    return <p>{state.recording.transcript}</p>;
  }
  const tree = (home: boolean) => (
    <MeetingProvider>{home ? <Home /> : <p>Settings</p>}</MeetingProvider>
  );
  const { rerender, getByText } = render(tree(true));
  act(() => meeting.setManualInput("Preserved draft"));
  await act(() => meeting.recording.startRecording());
  await act(() => meeting.recording.stopRecording());
  await waitFor(() =>
    expect(window.recording.transcribeAudio).toHaveBeenCalledOnce(),
  );
  rerender(tree(false));
  await act(async () => finish("Finished while in Settings"));
  rerender(tree(true));
  expect(getByText("Finished while in Settings")).toBeVisible();
  expect(meeting.manualInput).toBe("Preserved draft");
  expect(meeting.recording.isTranscribing).toBe(false);
});
