import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, RotateCcw, UploadCloud, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  isUploading?: boolean;
  referenceAudioUrl?: string | null;
}

const MAX_DURATION = 10;
const MIC_STORAGE_KEY = 'tonecoach-selected-mic';

export function AudioRecorder({ onRecordingComplete, isUploading, referenceAudioUrl }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem(MIC_STORAGE_KEY) || '';
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(mics);
      const saved = localStorage.getItem(MIC_STORAGE_KEY);
      if (saved && mics.some(d => d.deviceId === saved)) {
        setSelectedDeviceId(saved);
      } else if (mics.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(mics[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, []);

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [enumerateDevices]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(MIC_STORAGE_KEY, deviceId);
  };

  const getDeviceLabel = (device: MediaDeviceInfo, index: number) => {
    return device.label || `Microphone ${index + 1}`;
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (isRecording && duration >= MAX_DURATION) {
      stopRecording();
    }
  }, [duration, isRecording]);

  const startRecording = async () => {
    try {
      const audioConstraints: MediaStreamConstraints['audio'] = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      enumerateDevices();
      
      // Check for supported MIME types, prioritizing those that work on mobile
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      mediaRecorder.onstop = () => {
        let recordedType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        
        // Normalize MIME type for Safari/iOS
        if (recordedType.includes('audio/mp4') || recordedType.includes('audio/x-m4a')) {
          recordedType = 'audio/mp4';
        }
        
        console.log("Recording stopped. MIME type:", recordedType, "Chunks:", chunksRef.current.length);
        if (chunksRef.current.length === 0) {
          console.error("No data chunks captured!");
        }
        // Use audio/webm for blobs that are not mp4 to ensure desktop compatibility
        const finalType = recordedType === 'audio/mp4' ? 'audio/mp4' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(); // Remove 100ms chunks for now to see if it fixes desktop
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available. Please ensure you have granted permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const handleSubmit = () => {
    if (audioBlob) {
      // Use .mp4 extension for blobs typed as audio/mp4 to help server content-type detection
      const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([audioBlob], `recording-${Date.now()}.${extension}`, { type: audioBlob.type });
      onRecordingComplete(file);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-2xl border border-border/50 shadow-sm animate-in">
      {/* Visualizer / Status Area */}
      <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-muted/30">
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
        )}
        <div className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
          isRecording ? "bg-red-50 text-primary scale-110 shadow-lg shadow-red-500/10" : "bg-muted text-muted-foreground"
        )}>
          {isRecording ? (
            <div className="flex flex-col items-center">
              <span className="font-mono font-bold text-xl">{formatTime(duration)}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{MAX_DURATION - duration}s left</span>
            </div>
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!audioBlob ? (
          !isRecording ? (
            <Button 
              size="lg" 
              onClick={startRecording}
              className="h-12 px-8 rounded-full font-semibold text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5"
            >
              Start Recording
            </Button>
          ) : (
            <Button 
              size="lg" 
              variant="destructive"
              onClick={stopRecording}
              className="h-12 px-8 rounded-full font-semibold text-lg animate-pulse"
            >
              <Square className="w-4 h-4 mr-2" fill="currentColor" />
              Stop
            </Button>
          )
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-full space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Your recording</p>
                <audio src={audioUrl!} controls className="w-full h-10 rounded-full" data-testid="user-audio-player" />
              </div>
              {referenceAudioUrl && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-1">Reference</p>
                  <audio src={referenceAudioUrl} controls className="w-full h-10 rounded-full" data-testid="reference-audio-player" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetRecording} disabled={isUploading}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Redo
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isUploading}
                className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-green-500/20"
              >
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Submit Recording
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {audioDevices.length > 1 && !isRecording && (
        <div className="w-full max-w-xs" data-testid="select-microphone-container">
          <Select value={selectedDeviceId} onValueChange={handleDeviceChange}>
            <SelectTrigger data-testid="select-microphone-trigger" className="text-xs text-muted-foreground">
              <Mic className="w-3 h-3 mr-1.5 shrink-0" />
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent>
              {audioDevices.map((device, index) => (
                <SelectItem
                  key={device.deviceId}
                  value={device.deviceId}
                  data-testid={`select-microphone-option-${index}`}
                >
                  {getDeviceLabel(device, index)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <p className="text-sm text-muted-foreground max-w-xs text-center">
        {isRecording ? `Speak clearly — recording stops at ${MAX_DURATION} seconds.` : audioBlob ? "Listen to your recording or submit it for review." : `Press start when you are ready. Max ${MAX_DURATION} seconds.`}
      </p>
    </div>
  );
}
