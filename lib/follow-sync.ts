"use client";

import { useEffect, useState } from "react";

const followEventName = "ziddu:follow-change";
const followChannelName = "ziddu-follow-state";

export type FollowChange = {
  shopId: string;
  active: boolean;
  followerCount: number;
};

export function subscribeFollowChanges(onChange: (change: FollowChange) => void) {
  const handleEvent = (event: Event) => onChange((event as CustomEvent<FollowChange>).detail);
  window.addEventListener(followEventName, handleEvent);
  if (!("BroadcastChannel" in window)) return () => window.removeEventListener(followEventName, handleEvent);

  const channel = new BroadcastChannel(followChannelName);
  channel.addEventListener("message", (event: MessageEvent<FollowChange>) => onChange(event.data));
  return () => {
    window.removeEventListener(followEventName, handleEvent);
    channel.close();
  };
}

export function publishFollowChange(change: FollowChange) {
  window.dispatchEvent(new CustomEvent<FollowChange>(followEventName, { detail: change }));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(followChannelName);
    channel.postMessage(change);
    channel.close();
  }
}

export function useFollowSync(shopId: string, initialActive: boolean, initialFollowerCount: number) {
  const [state, setState] = useState<FollowChange>({
    shopId,
    active: initialActive,
    followerCount: initialFollowerCount,
  });

  useEffect(() => {
    return subscribeFollowChanges((change) => {
      if (change.shopId === shopId) setState(change);
    });
  }, [shopId]);

  function updateFollowed(active: boolean) {
    const followerCount = Math.max(0, state.followerCount + (active === state.active ? 0 : active ? 1 : -1));
    const nextState = { shopId, active, followerCount };
    setState(nextState);
    publishFollowChange(nextState);
  }

  return { followed: state.active, followerCount: state.followerCount, updateFollowed };
}
