"use client";

import { useState } from "react";
import {
  ImagePost,
  VideoPost,
  type PostCoreProps,
  type PostEngagement,
} from "@/components/features/discover/post-components";

type PostCardProps = PostCoreProps;

export default function PostCard(props: PostCardProps) {
  const { post } = props;
  const [shareLabel, setShareLabel] = useState("");

  async function sharePost() {
    const route = post.mediaType === "video" ? "/reels" : "/";
    const url = `${window.location.origin}${route}?post=${encodeURIComponent(post.id)}`;
    const text = `Check out this ${post.mediaType === "video" ? "Reel" : "post"} from ${props.shop.name} in ${props.shop.area}, ${props.shop.city}.`;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareLabel("Could not share link");
    }
  }

  const engagement: PostEngagement = {
    shareLabel,
    onShare: sharePost,
  };
  const presentation = { ...props, engagement };

  if (post.mediaType === "video" || post.kind === "reel") {
    return <VideoPost {...presentation} />;
  }

  return <ImagePost {...presentation} />;
}
