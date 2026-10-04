"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

let activeVideo: HTMLVideoElement | null = null;
const soundPreferenceKey = "ziddu-reel-sound";

type ReelVideoPlayerProps = { src: string; poster: string; alt: string; onError: () => void };

export default function ReelVideoPlayer({ src, poster, alt, onError }: ReelVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(() => typeof window === "undefined" || window.sessionStorage.getItem(soundPreferenceKey) !== "on");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<"play" | "pause" | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const pauseOtherVideos = () => {
      if (activeVideo && activeVideo !== video) activeVideo.pause();
      activeVideo = video;
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        pauseOtherVideos();
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
        setPlaying(false);
      }
    }, { threshold: 0.7 });
    observer.observe(video);
    return () => {
      observer.disconnect();
      if (activeVideo === video) activeVideo = null;
    };
  }, []);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (activeVideo && activeVideo !== video) activeVideo.pause();
      activeVideo = video;
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      setFeedback("play");
    } else {
      video.pause();
      setPlaying(false);
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

  return <div className="reel-video-player" onClick={togglePlayback} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); togglePlayback(); } }} role="button" tabIndex={0}>
    <Image alt="" className="reel-player-poster" fill priority={false} sizes="(max-width: 620px) 100vw, 520px" src={poster} unoptimized />
    <video aria-label={alt} controls={false} loop muted={muted} onCanPlay={() => setLoading(false)} onError={onError} playsInline poster={poster} preload="metadata" ref={videoRef} src={src} />
    {loading && <span aria-live="polite" className="reel-video-loading">Loading Reel...</span>}
    {feedback && <span aria-hidden="true" className="reel-play-feedback">{feedback === "play" ? <Play fill="currentColor" size={30} /> : <Pause fill="currentColor" size={30} />}</span>}
    <button aria-label={muted ? "Unmute Reel" : "Mute Reel"} className="reel-sound-button" onClick={toggleSound} type="button">{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
    {!playing && !loading && <span aria-hidden="true" className="reel-paused-mark"><Play fill="currentColor" size={24} /></span>}
  </div>;
}
