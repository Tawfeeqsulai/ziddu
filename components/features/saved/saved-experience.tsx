"use client";

import { useState } from "react";
import { Bookmark, Clapperboard, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import PostCard from "@/components/features/discover/post-card";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/states";
import type { DiscoveryData, FeedPost } from "@/types/commerce";

type SavedExperienceProps = { initial: DiscoveryData };
type SavedFilter = "all" | "posts" | "reels";

export default function SavedExperience({ initial }: SavedExperienceProps) {
    const router = useRouter();
    const [posts, setPosts] = useState(initial.posts);
    const [liked, setLiked] = useState(() => initial.posts.filter((post) => post.liked).map((post) => post.id));
    const [followed, setFollowed] = useState(() => initial.shops.filter((shop) => shop.followed).map((shop) => shop.id));
    const [filter, setFilter] = useState<SavedFilter>("all");
    const [error, setError] = useState("");

    async function interact(action: "like" | "save" | "follow", id: string) {
        setError("");
        const wasActive = action === "like" ? liked.includes(id) : action === "follow" ? followed.includes(id) : true;
        if (action === "like") setLiked((items) => wasActive ? items.filter((item) => item !== id) : [...items, id]);
        else if (action === "follow") setFollowed((items) => wasActive ? items.filter((item) => item !== id) : [...items, id]);
        else setPosts((items) => items.filter((post) => post.id !== id));

        const payload = action === "follow" ? { action, shopId: id } : { action, postId: id };
        try {
            const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, active: !wasActive }) });
            if (!response.ok) throw new Error("Interaction unavailable");
            window.dispatchEvent(new Event("ziddu:feed-mutation"));
        } catch {
            if (action === "like") setLiked((items) => wasActive ? [...items, id] : items.filter((item) => item !== id));
            else if (action === "follow") setFollowed((items) => wasActive ? [...items, id] : items.filter((item) => item !== id));
            else {
                const post = initial.posts.find((item) => item.id === id);
                if (post) setPosts((items) => items.some((item) => item.id === id) ? items : [...items, post]);
            }
            setError("That action could not be saved. Please try again.");
        }
    }

    const visiblePosts = posts.filter((post) => filter === "all" || (filter === "reels" ? post.mediaType === "video" : post.mediaType !== "video"));
    const shopForPost = (post: FeedPost) => initial.shops.find((shop) => shop.id === post.shopId)!;

    return <main className="saved-page">
        <header className="saved-header">
            <BackButton className="saved-back" label="Go back" />
            <div><span className="section-kicker">YOUR COLLECTION</span><h1>Saved</h1></div>
            <Bookmark aria-hidden="true" className="saved-heading-icon" size={22} />
        </header>
        <nav aria-label="Filter saved items" className="saved-tabs" role="tablist">
            {([["all", "All", Bookmark], ["posts", "Posts", ImageIcon], ["reels", "Videos", Clapperboard]] as const).map(([value, label, Icon]) => <button aria-selected={filter === value} className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value)} role="tab" type="button"><Icon size={15} />{label}</button>)}
        </nav>
        {error && <p aria-live="polite" className="saved-error" role="alert">{error}</p>}
        {visiblePosts.length === 0 ? <EmptyState description={posts.length ? "There are no saved items in this section." : "Posts and Videos you save will appear here."} title={posts.length ? "Nothing in this filter" : "Nothing saved yet"} actionLabel="Explore nearby" onAction={() => router.push("/search")} /> : <section aria-label="Saved posts and Videos" className="saved-posts">{visiblePosts.map((post) => {
            const shop = shopForPost(post);
            return <PostCard key={post.id} followed={followed.includes(shop.id)} liked={liked.includes(post.id)} onCheckout={() => router.push(`/shops/${shop.id}`)} onFollow={() => { void interact("follow", shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => router.push(`/shops/${shop.id}`)} onSave={() => { void interact("save", post.id); }} post={post} saved={true} shop={shop} />;
        })}</section>}
        <BottomNavigation />
    </main>;
}
