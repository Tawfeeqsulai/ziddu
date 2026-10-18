"use client";

import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

let activeVideo: HTMLVideoElement | null = null;
const soundPreferenceKey = "ziddu-reel-sound";

type ReelVideoPlayerProps = { src: string; poster: string; alt: string; onError: () => void; onDoubleClick?: () => void };

export default function ReelVideoPlayer({ src, poster, alt, onError, onDoubleClick }: ReelVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<"play" | "pause" | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const savedSound = window.sessionStorage.getItem(soundPreferenceKey);
    const soundSyncTimer = savedSound === "on" ? window.setTimeout(() => {
      setMuted(false);
      video.muted = false;
    }, 0) : null;
    const pauseOtherVideos = () => {
      if (activeVideo && activeVideo !== video) activeVideo.pause();
      activeVideo = video;
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        pauseOtherVideos();
        void video.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setShowControls(true); });
      } else {
        video.pause();
        setPlaying(false);
      }
    }, { threshold: 0.35 });
    observer.observe(video);
    return () => {
      if (soundSyncTimer !== null) window.clearTimeout(soundSyncTimer);
      observer.disconnect();
      if (activeVideo === video) activeVideo = null;
    };
  }, []);

  function seek(seconds: number, event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
    setProgress(video.currentTime);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (activeVideo && activeVideo !== video) activeVideo.pause();
      activeVideo = video;
      setShowControls(false);
      void video.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setShowControls(true); });
      setFeedback("play");
    } else {
      video.pause();
      setPlaying(false);
      setShowControls(true);
      setFeedback("pause");
    }
    window.setTimeout(() => setFeedback(null), 650);
  }

  function toggleSound(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    window.sessionStorage.setItem(soundPreferenceKey, nextMuted ? "off" : "on");
  }

  return <div className="reel-video-player" onClick={(event) => { if ((event.target as HTMLElement).closest("button, input")) return; togglePlayback(); }} onDoubleClick={(event) => { event.preventDefault(); onDoubleClick?.(); }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === " " || event.key === "Enter") { event.preventDefault(); togglePlayback(); } }} role="group" aria-label="Video player controls" tabIndex={0}>
    <Image alt="" className="reel-player-poster" fill priority={false} sizes="(max-width: 620px) 100vw, 520px" src={poster} unoptimized />
    <video aria-label={alt} controls={false} loop muted={muted} onCanPlay={() => setLoading(false)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onError={onError} onPause={() => setPlaying(false)} onPlay={() => { setPlaying(true); setShowControls(false); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} playsInline poster={poster} preload="metadata" ref={videoRef} src={src} />
    {loading && <span aria-live="polite" className="reel-video-loading">Loading Reel...</span>}
    {feedback && <span aria-hidden="true" className="reel-play-feedback">{feedback === "play" ? <Play fill="currentColor" size={30} /> : <Pause fill="currentColor" size={30} />}</span>}
    {showControls && <button aria-label={muted ? "Unmute Reel" : "Mute Reel"} className="reel-sound-button" onClick={toggleSound} type="button">{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>}
    {showControls && <div className="reel-transport" onClick={(event) => event.stopPropagation()}>
      <div className="reel-transport-buttons">
        <button aria-label="Back 10 seconds" onClick={(event) => seek(-10, event)} type="button"><RotateCcw size={20} /><span>10</span></button>
        <button aria-label={playing ? "Pause Reel" : "Play Reel"} className="reel-play-toggle" onClick={(event) => { event.stopPropagation(); togglePlayback(); }} type="button">{playing ? <Pause fill="currentColor" size={25} /> : <Play fill="currentColor" size={25} />}</button>
        <button aria-label="Forward 10 seconds" onClick={(event) => seek(10, event)} type="button"><RotateCw size={20} /><span>10</span></button>
      </div>
      <div aria-label="Video progress" className="reel-progress-track"><span style={{ width: `${duration ? Math.min(100, progress / duration * 100) : 0}%` }} /></div>
    </div>}
  </div>;
}
