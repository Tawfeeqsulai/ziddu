const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const seedTime = new Date();
const dayInMilliseconds = 24 * 60 * 60 * 1000;

function offerDuration(startOffsetDays, endOffsetDays) {
  return {
    validityFrom: new Date(seedTime.getTime() + startOffsetDays * dayInMilliseconds),
    validityTo: new Date(seedTime.getTime() + endOffsetDays * dayInMilliseconds),
  };
}

function publishedHoursAgo(hoursAgo) {
  return new Date(seedTime.getTime() - hoursAgo * 60 * 60 * 1000);
}

function withoutId(value) {
  const copy = { ...value };
  delete copy.id;
  return copy;
}

const locations = [
  { id: "65f000000000000000000001", address: "12, 2nd Avenue, Anna Nagar West", locality: "Anna Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600040", latitude: 13.085, longitude: 80.21 },
  { id: "65f000000000000000000002", address: "88, Usman Road", locality: "T. Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600017", latitude: 13.0418, longitude: 80.2341 },
  { id: "65f000000000000000000003", address: "27, Gandhi Nagar Main Road", locality: "Adyar", city: "Chennai", state: "Tamil Nadu", pincode: "600020", latitude: 13.0067, longitude: 80.2572 },
  { id: "65f000000000000000000004", address: "45, Velachery Main Road", locality: "Velachery", city: "Chennai", state: "Tamil Nadu", pincode: "600042", latitude: 12.9815, longitude: 80.218 },
  { id: "65f000000000000000000005", address: "19, New Avadi Road", locality: "Kilpauk", city: "Chennai", state: "Tamil Nadu", pincode: "600010", latitude: 13.0781, longitude: 80.242 },
  { id: "65f000000000000000000006", address: "6, OMR Service Road", locality: "OMR", city: "Chennai", state: "Tamil Nadu", pincode: "600096", latitude: 12.9352, longitude: 80.2304 },
];

const users = [
  { id: "seed-user-001", email: "arun.demo@ziddu.local", name: "Arun Kumar", username: "arunkumar", phoneNumber: "+919000000001", city: "Chennai", locality: "Anna Nagar", interests: ["RESTAURANT", "ELECTRONICS"] },
  { id: "seed-user-002", email: "meera.demo@ziddu.local", name: "Meera Iyer", username: "meera_iyer", phoneNumber: "+919000000002", city: "Chennai", locality: "T. Nagar", interests: ["FURNITURE", "RESTAURANT"] },
];

const shops = [
  { id: "65f100000000000000000001", handle: "ssbiriyani.annanagar", name: "SS Biriyani", category: "RESTAURANT", initials: "SS", locationId: locations[0].id, phone: "+91 90000 00011", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=85", description: "Chennai-style biriyani and traditional favourites, cooked fresh every day.", rating: 4.8 },
  { id: "65f100000000000000000002", handle: "aasifebiriyani.tnagar", name: "Aasife Biriyani", category: "RESTAURANT", initials: "AB", locationId: locations[1].id, phone: "+91 90000 00012", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85", description: "Dum-cooked biriyani and family meals near T. Nagar.", rating: 4.7 },
  { id: "65f100000000000000000003", handle: "srikrishnasweets.adyar", name: "Sri Krishna Sweets", category: "RESTAURANT", initials: "SK", locationId: locations[2].id, phone: "+91 90000 00013", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85", description: "Fresh Mysurpa and South Indian sweets made in small batches.", rating: 4.7 },
  { id: "65f100000000000000000004", handle: "chennaimobiles.velachery", name: "Chennai Mobiles", category: "ELECTRONICS", initials: "CM", locationId: locations[3].id, phone: "+91 90000 00014", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85", description: "Smartphones, accessories and helpful local service in Velachery.", rating: 4.6 },
  { id: "65f100000000000000000005", handle: "homespace.kilpauk", name: "HomeSpace Furniture", category: "FURNITURE", initials: "HS", locationId: locations[4].id, phone: "+91 90000 00015", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85", description: "Comfortable sofas and considered furniture for Chennai homes.", rating: 4.8 },
  { id: "65f100000000000000000006", handle: "woodcraft.omr", name: "WoodCraft Interiors", category: "FURNITURE", initials: "WI", locationId: locations[5].id, phone: "+91 90000 00016", image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=85", description: "Dining, bedroom and workspace pieces designed for modern homes.", rating: 4.5 },
];

const menuCategories = [
  { id: "65f210000000000000000001", shopId: shops[0].id, name: "Biriyani" },
  { id: "65f210000000000000000002", shopId: shops[0].id, name: "Starters & Sides" },
  { id: "65f210000000000000000003", shopId: shops[1].id, name: "Biriyani & Rice" },
  { id: "65f210000000000000000004", shopId: shops[2].id, name: "Sweets & Snacks" },
  { id: "65f210000000000000000005", shopId: shops[3].id, name: "Smartphones" },
  { id: "65f210000000000000000006", shopId: shops[3].id, name: "Accessories" },
  { id: "65f210000000000000000007", shopId: shops[4].id, name: "Sofas" },
  { id: "65f210000000000000000008", shopId: shops[5].id, name: "Dining & Living" },
];

const menuSubCategories = [
  { id: "65f220000000000000000001", shopId: shops[0].id, categoryId: menuCategories[0].id, name: "Chicken" },
  { id: "65f220000000000000000002", shopId: shops[0].id, categoryId: menuCategories[1].id, name: "Sides" },
  { id: "65f220000000000000000003", shopId: shops[3].id, categoryId: menuCategories[4].id, name: "Audio" },
  { id: "65f220000000000000000004", shopId: shops[4].id, categoryId: menuCategories[6].id, name: "Three Seaters" },
];

const products = [
  { id: "65f200000000000000000001", shopId: shops[0].id, menuCategoryId: menuCategories[0].id, name: "Chicken Biriyani Combo", description: "Seeraga samba chicken biriyani with a side", priceInr: 249 },
  { id: "65f200000000000000000002", shopId: shops[0].id, menuCategoryId: menuCategories[1].id, name: "Mutton Sukka", description: "Peppery tender mutton served with onions", priceInr: 189 },
  { id: "65f200000000000000000003", shopId: shops[1].id, menuCategoryId: menuCategories[2].id, name: "Mutton Biriyani", description: "Slow-cooked mutton biriyani with raita", priceInr: 329 },
  { id: "65f200000000000000000004", shopId: shops[2].id, menuCategoryId: menuCategories[3].id, name: "Mysurpa Gift Box", description: "Fresh ghee Mysurpa in a family-sized box", priceInr: 420 },
  { id: "65f200000000000000000005", shopId: shops[3].id, menuCategoryId: menuCategories[4].id, name: "Everyday Smartphone", description: "A reliable smartphone for everyday use", priceInr: 24999 },
  { id: "65f200000000000000000006", shopId: shops[3].id, menuCategoryId: menuCategories[5].id, name: "Noise-Cancelling Earbuds", description: "Compact wireless earbuds with a charging case", priceInr: 1999 },
  { id: "65f200000000000000000007", shopId: shops[4].id, menuCategoryId: menuCategories[6].id, name: "Cloud Sofa", description: "Three-seater fabric sofa", priceInr: 34999 },
  { id: "65f200000000000000000008", shopId: shops[5].id, menuCategoryId: menuCategories[7].id, name: "Solid Wood Dining Table", description: "Six-seater dining table made for everyday gatherings", priceInr: 28999 },
  { id: "65f200000000000000000009", shopId: shops[5].id, menuCategoryId: menuCategories[7].id, name: "Cane Lounge Chair", description: "Hand-finished accent chair for reading corners", priceInr: 8999 },
];

const posts = [
  { id: "65f300000000000000000001", shopId: shops[0].id, type: "IMAGE", title: "Weekend biriyani, served hot", description: "Dum-cooked with seeraga samba rice. Available today until 11 PM.", mediaUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1200&q=88", altText: "Chicken biriyani served on a plate", hashtags: ["#ChennaiBiriyani", "#AnnaNagar"], isOfferIncluded: true, offerId: "65f400000000000000000001", publishedAt: new Date("2026-09-30T08:00:00Z") },
  { id: "65f300000000000000000002", shopId: shops[1].id, type: "VIDEO", title: "Dosa batter to crisp dosa", description: "A quick morning Reel from our T. Nagar kitchen.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=88", altText: "Fresh dosa being prepared", hashtags: ["#TNagar", "#Dosa"], publishedAt: new Date("2026-09-30T07:00:00Z") },
  { id: "65f300000000000000000003", shopId: shops[2].id, type: "IMAGE", title: "Mysurpa made fresh today", description: "Small-batch sweets ready for the evening table.", mediaUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=88", altText: "Fresh Indian sweets", hashtags: ["#Adyar", "#Mysurpa"], publishedAt: new Date("2026-09-30T06:00:00Z") },
  { id: "65f300000000000000000004", shopId: shops[3].id, type: "IMAGE", title: "New smartphone arrivals", description: "Drop by Velachery Main Road for an exchange quote and demo.", mediaUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=88", altText: "Smartphone on display", hashtags: ["#Velachery", "#TechOffers"], isOfferIncluded: true, offerId: "65f400000000000000000002", publishedAt: new Date("2026-09-29T09:00:00Z") },
  { id: "65f300000000000000000005", shopId: shops[4].id, type: "IMAGE", title: "A softer corner for home", description: "Our Cloud Sofa is made for slow evenings and long conversations.", mediaUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=88", altText: "Comfortable sofa in a showroom", hashtags: ["#Kilpauk", "#ChennaiHomes"], isOfferIncluded: true, offerId: "65f400000000000000000003", publishedAt: new Date("2026-09-29T08:00:00Z") },
  { id: "65f300000000000000000006", shopId: shops[5].id, type: "VIDEO", title: "Dining table, made for Sundays", description: "A look around our OMR showroom and new solid-wood collection.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=88", altText: "Dining furniture showroom", hashtags: ["#OMR", "#WoodCraft"], publishedAt: new Date("2026-09-28T08:00:00Z") },
  { id: "65f300000000000000000007", shopId: shops[0].id, type: "IMAGE", title: "A proper Chennai lunch, close by", description: "Freshly cooked meals and a little extra care in every serving. Come by Anna Nagar today.", mediaUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1200&q=88", altText: "Traditional Indian lunch served fresh", hashtags: ["#AnnaNagar", "#ChennaiFood"], publishedAt: publishedHoursAgo(2) },
  { id: "65f300000000000000000008", shopId: shops[0].id, type: "VIDEO", title: "The biriyani dum is ready", description: "A quick peek at today's handi coming off the dum. Fresh batches are on until late.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=1200&q=88", altText: "Fresh biriyani ready to serve", hashtags: ["#Biriyani", "#ChennaiEats"], publishedAt: publishedHoursAgo(5) },
  { id: "65f300000000000000000009", shopId: shops[1].id, type: "IMAGE", title: "A crispy dosa for the table", description: "Golden at the edges, soft in the middle, served with fresh chutneys from our T. Nagar kitchen.", mediaUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1200&q=88", altText: "Crispy dosa with chutneys", hashtags: ["#TNagar", "#DosaTime"], publishedAt: publishedHoursAgo(8) },
  { id: "65f300000000000000000010", shopId: shops[1].id, type: "VIDEO", title: "Fresh off the tawa", description: "Watch the dosa turn golden before it reaches your table. Made to order all day.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=1200&q=88", altText: "Dosa cooking on a hot tawa", hashtags: ["#Tawa", "#TNGarEats"], publishedAt: publishedHoursAgo(12) },
  { id: "65f300000000000000000011", shopId: shops[2].id, type: "IMAGE", title: "Small-batch sweets for sharing", description: "A fresh box of Mysurpa and classic favourites, packed for visits, celebrations or a quiet cup of tea.", mediaUrl: "https://images.unsplash.com/photo-1605197161470-5d2f4512f8a1?auto=format&fit=crop&w=1200&q=88", altText: "Assorted Indian sweets ready to share", hashtags: ["#Adyar", "#MadeFresh"], publishedAt: publishedHoursAgo(16) },
  { id: "65f300000000000000000012", shopId: shops[2].id, type: "VIDEO", title: "Packing today's Mysurpa boxes", description: "Freshly cut, carefully packed and ready to take home from our Adyar shop.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=88", altText: "Fresh Mysurpa sweets being packed", hashtags: ["#Mysurpa", "#AdyarSweets"], publishedAt: publishedHoursAgo(20) },
  { id: "65f300000000000000000013", shopId: shops[3].id, type: "IMAGE", title: "Find the right everyday phone", description: "Compare this season's arrivals with our team and get a hands-on demo in Velachery.", mediaUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=88", altText: "Modern smartphone on display", hashtags: ["#Velachery", "#PhoneShopping"], publishedAt: publishedHoursAgo(24) },
  { id: "65f300000000000000000014", shopId: shops[4].id, type: "IMAGE", title: "Make room for a slower evening", description: "Explore soft fabrics, generous seating and a new collection made for everyday living.", mediaUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=88", altText: "Comfortable sofa in a bright living room", hashtags: ["#Kilpauk", "#HomeIdeas"], publishedAt: publishedHoursAgo(30) },
  { id: "65f300000000000000000015", shopId: shops[4].id, type: "VIDEO", title: "A closer look at the Cloud Sofa", description: "See the fabric, the finish and the room-ready proportions at our Kilpauk showroom.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=88", altText: "Cloud sofa displayed in a showroom", hashtags: ["#Furniture", "#Kilpauk"], publishedAt: publishedHoursAgo(36) },
  { id: "65f300000000000000000016", shopId: shops[5].id, type: "IMAGE", title: "A dining table built for gathering", description: "Solid wood, considered details and room for everyone. Visit us on OMR to see the collection.", mediaUrl: "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&q=88", altText: "Solid wood dining table set for a meal", hashtags: ["#OMR", "#DiningRoom"], publishedAt: publishedHoursAgo(42) },
  { id: "65f300000000000000000017", shopId: shops[5].id, type: "IMAGE", title: "A reading corner with natural texture", description: "Bring warmth to an empty corner with hand-finished wood and woven details from our OMR showroom.", mediaUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88", altText: "Warmly styled reading corner with natural furniture", hashtags: ["#WoodCraft", "#HomeDetails"], publishedAt: publishedHoursAgo(48) },
  { id: "65f300000000000000000018", shopId: shops[3].id, type: "VIDEO", title: "A quick look at the new arrivals", description: "Fresh devices and accessories are on display. Drop by and try them out before choosing.", mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=88", altText: "New smartphone arrivals on display", hashtags: ["#ChennaiMobiles", "#NewArrivals"], publishedAt: publishedHoursAgo(54) },
];

async function main() {
  for (const location of locations) await prisma.location.upsert({ where: { id: location.id }, update: withoutId(location), create: location });
  for (const user of users) await prisma.user.upsert({ where: { id: user.id }, update: withoutId(user), create: { ...user, emailVerified: true, phoneNumberVerified: true, onboardingCompleted: true } });
  for (const shop of shops) await prisma.shop.upsert({ where: { id: shop.id }, update: withoutId(shop), create: { ...shop, status: "Open now", vendorStatus: "VERIFIED", workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] } });
  for (const category of menuCategories) await prisma.menuCategory.upsert({ where: { id: category.id }, update: withoutId(category), create: category });
  for (const subCategory of menuSubCategories) await prisma.menuSubCategory.upsert({ where: { id: subCategory.id }, update: withoutId(subCategory), create: subCategory });
  for (const product of products) await prisma.product.upsert({ where: { id: product.id }, update: withoutId(product), create: product });

  const offers = [
    { id: "65f400000000000000000001", shopId: shops[0].id, targetType: "ITEM", targetId: products[0].id, offerType: "FIXED", offerValue: { priceInr: 199, originalPriceInr: 249, badge: "WEEKEND OFFER" }, ...offerDuration(0, 7), productId: products[0].id },
    { id: "65f400000000000000000002", shopId: shops[3].id, targetType: "ITEM", targetId: products[4].id, offerType: "FIXED", offerValue: { priceInr: 22999, originalPriceInr: 24999, badge: "EXCHANGE OFFER" }, ...offerDuration(0, 14), productId: products[4].id },
    { id: "65f400000000000000000003", shopId: shops[4].id, targetType: "ITEM", targetId: products[6].id, offerType: "PERCENTAGE", offerValue: { priceInr: 29999, originalPriceInr: 34999, badge: "15% OFF" }, ...offerDuration(0, 30), productId: products[6].id },
    { id: "65f400000000000000000004", shopId: shops[3].id, targetType: "ITEM", targetId: products[5].id, offerType: "FIXED", offerValue: { priceInr: 1699, originalPriceInr: 1999, badge: "TECH WEEK" }, ...offerDuration(-8, -1), productId: products[5].id },
    { id: "65f400000000000000000005", shopId: shops[5].id, targetType: "ITEM", targetId: products[7].id, offerType: "FIXED", offerValue: { priceInr: 25999, originalPriceInr: 28999, badge: "HOME REFRESH" }, ...offerDuration(0, 21), productId: products[7].id },
  ];
  for (const offer of offers) await prisma.offer.upsert({ where: { id: offer.id }, update: withoutId(offer), create: offer });
  for (const post of posts) await prisma.post.upsert({ where: { id: post.id }, update: withoutId(post), create: post });

  const follows = [{ userId: users[0].id, shopId: shops[0].id }, { userId: users[0].id, shopId: shops[4].id }, { userId: users[1].id, shopId: shops[1].id }];
  for (const follow of follows) await prisma.follow.upsert({ where: { userId_shopId: follow }, update: {}, create: follow });
  const likes = [{ userId: users[0].id, postId: posts[0].id }, { userId: users[0].id, postId: posts[3].id }, { userId: users[1].id, postId: posts[1].id }];
  for (const like of likes) await prisma.like.upsert({ where: { userId_postId: like }, update: {}, create: like });
  const saves = [{ userId: users[0].id, postId: posts[4].id }, { userId: users[1].id, postId: posts[2].id }];
  for (const save of saves) await prisma.save.upsert({ where: { userId_postId: save }, update: {}, create: save });

  console.log(`Seeded ${users.length} users, ${shops.length} shops, ${menuCategories.length} menu categories, ${products.length} products, ${posts.length} posts and Reels, ${offers.length} offers, and interaction records.`);
}

main().catch((error) => { console.error("Seed failed:", error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());