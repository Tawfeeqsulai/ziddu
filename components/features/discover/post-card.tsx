"use client";

import { useState } from "react";
import {
  ImagePost,
  VideoPost,
  type PostCoreProps,
  type PostEngagement,
} from "@/components/features/discover/post-components";
import { getPostSharePath } from "@/lib/post-share-id";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";

type PostCardProps = PostCoreProps;

export default function PostCard(props: PostCardProps) {
  const { post } = props;
  const { requireLogin } = useLoginPrompt();
  const [shareLabel, setShareLabel] = useState("");
  const [localShareTaps, setLocalShareTaps] = useState(0);

  async function sharePost() {
    if (!requireLogin()) return;
    const sharePath = getPostSharePath(post.id) ?? `/shops/${encodeURIComponent(props.shop.id)}`;
    const url = new URL(sharePath, window.location.origin).toString();
    const text = `View ${post.title} from ${props.shop.name} on ZIDDU.`;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied");
      }
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "share", postId: post.id, shopId: props.shop.id }) });
      if (!response.ok) throw new Error("Share count unavailable");
      setLocalShareTaps((count) => count + 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareLabel(error instanceof Error && error.message === "Share count unavailable" ? "Shared, but the share count could not be saved" : "Could not share link");
    }
  }

  const engagement: PostEngagement = {
    shareLabel,
    shareCount: (post.shares ?? 0) + localShareTaps,
    onShare: sharePost,
  };
  const presentation = { ...props, engagement };

  if (post.mediaType === "video" || post.kind === "reel") {
    return <VideoPost {...presentation} />;
  }

  return <ImagePost {...presentation} />;
}
