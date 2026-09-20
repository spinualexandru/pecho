import { createContext, useContext, useState, type ReactNode } from "react";
import { useRecording } from "@/hooks/useRecording";
import { useSummary } from "@/hooks/useSummary";

function useMeetingState() {
  const recording = useRecording();
  const summary = useSummary();
  const [manualInput, setManualInput] = useState("");
  const [useManualMode, setUseManualMode] = useState(false);
  return {
    recording,
    summary,
    manualInput,
    setManualInput,
    useManualMode,
    setUseManualMode,
  };
}
const MeetingContext = createContext<ReturnType<typeof useMeetingState> | null>(
  null,
);
export function MeetingProvider({ children }: { children: ReactNode }) {
  const meeting = useMeetingState();
  return <MeetingContext value={meeting}>{children}</MeetingContext>;
}
export function useMeeting() {
  const meeting = useContext(MeetingContext);
  if (!meeting) throw new Error("MeetingProvider is required");
  return meeting;
}
