"use client";

import { useState } from "react";
import {
  ImagePost,
  VideoPost,
  type PostCoreProps,
  type PostEngagement,
} from "@/components/features/discover/post-components";
import { getPostSharePath } from "@/lib/post-share-id";

type PostCardProps = PostCoreProps;

export default function PostCard(props: PostCardProps) {
  const { post } = props;
  const [shareLabel, setShareLabel] = useState("");
  const [localShareTaps, setLocalShareTaps] = useState(0);

  async function sharePost() {
    const sharePath = getPostSharePath(post.id) ?? `/shops/${encodeURIComponent(props.shop.id)}`;
    const url = new URL(sharePath, window.location.origin).toString();
    const text = `View ${post.title} from ${props.shop.name} on ZIDDU.`;
    setLocalShareTaps((count) => count + 1);
    void fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "share", postId: post.id, shopId: props.shop.id }) })
      .then((response) => { if (!response.ok) throw new Error("Share count unavailable"); window.dispatchEvent(new Event("ziddu:feed-mutation")); })
      .catch(() => setLocalShareTaps((count) => Math.max(0, count - 1)));
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
    shareCount: (post.shares ?? 0) + localShareTaps,
    onShare: sharePost,
  };
  const presentation = { ...props, engagement };

  if (post.mediaType === "video" || post.kind === "reel") {
    return <VideoPost {...presentation} />;
  }

  return <ImagePost {...presentation} />;
}
