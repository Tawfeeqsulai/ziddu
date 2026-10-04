import type { DiscoveryData, FeedPost, Shop } from "@/types/commerce";

export type AIResultType = "shop" | "product" | "offer" | "post" | "location";

export type AIProductResult = {
  id: string;
  name: string;
  shop: Shop;
  price: number;
  description: string;
};

export type AIResult =
  | { type: "shop"; shop: Shop }
  | { type: "product"; product: AIProductResult }
  | { type: "offer"; post: FeedPost; shop: Shop }
  | { type: "post"; post: FeedPost; shop: Shop }
  | { type: "location"; label: string; detail: string };

export type AIMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: AIResult[];
};

export type AIService = {
  respond(prompt: string): Promise<Omit<AIMessage, "id" | "role">>;
};

function shopForPost(post: FeedPost, shops: Shop[]) {
  return shops.find((shop) => shop.id === post.shopId);
}

function firstMatchingShop(data: DiscoveryData, prompt: string) {
  const normalized = prompt.toLowerCase();
  const category = normalized.includes("furniture") ? "FURNITURE" : normalized.includes("electronic") || normalized.includes("earbud") ? "ELECTRONICS" : normalized.includes("restaurant") || normalized.includes("biriyani") || normalized.includes("food") ? "RESTAURANT" : undefined;
  return data.shops.find((shop) => !category || shop.category === category) ?? data.shops[0];
}

export class MockAIService implements AIService {
  constructor(private readonly data: DiscoveryData) {}

  async respond(prompt: string) {
    const shop = firstMatchingShop(this.data, prompt);
    const normalized = prompt.toLowerCase();
    const wantsOffers = normalized.includes("offer") || normalized.includes("deal") || normalized.includes("under");
    const wantsProduct = normalized.includes("earbud") || normalized.includes("sofa") || normalized.includes("product");
    const matchingPost = this.data.posts.find((post) => {
      const postShop = shopForPost(post, this.data.shops);
      return postShop && (wantsOffers ? post.kind === "offer" : postShop.id === shop.id);
    });

    if (wantsProduct) {
      const productShop = normalized.includes("sofa") ? this.data.shops.find((item) => item.category === "FURNITURE") : this.data.shops.find((item) => item.category === "ELECTRONICS");
      const selectedShop = productShop ?? shop;
      return {
        text: `Here is a local ${normalized.includes("sofa") ? "furniture" : "electronics"} find to start with.`,
        results: [{ type: "product" as const, product: { id: `mock-product-${selectedShop.id}`, name: normalized.includes("sofa") ? "Everyday comfort sofa" : "Wireless earbuds", shop: selectedShop, price: normalized.includes("sofa") ? 24999 : 1999, description: `A useful pick from ${selectedShop.name}.` } }],
      };
    }

    if (matchingPost && shopForPost(matchingPost, this.data.shops)) {
      return {
        text: wantsOffers ? "I found a nearby offer worth a look." : `I found a local ${matchingPost.mediaType === "video" ? "Reel" : "post"} from a shop around you.`,
        results: [{ type: matchingPost.kind === "offer" ? "offer" as const : "post" as const, post: matchingPost, shop: shopForPost(matchingPost, this.data.shops)! }],
      };
    }

    return {
      text: `These local spots may match what you are looking for around ${shop.city}.`,
      results: [
        { type: "shop" as const, shop },
        ...this.data.shops.filter((item) => item.id !== shop.id && item.category === shop.category).slice(0, 1).map((item) => ({ type: "shop" as const, shop: item })),
      ],
    };
  }
}
