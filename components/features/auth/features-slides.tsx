"use client";

import { Armchair, ArrowLeft, ArrowRight, BadgePercent, CreditCard, Headphones, Heart, MapPin, Navigation, ShoppingBag, Store, Utensils } from "lucide-react";
import { useRef, useState } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";

const slides = [
    {
        eyebrow: "YOUR CITY. YOUR VIBE.",
        title: <>Everything<br />nearby.</>,
        mobileTitle: <>Your city.<br />Your vibe.<br />Everything nearby.</>,
        description: "Explore shops, offers, creators and local businesses, all in one place.",
        icon: MapPin,
        note: "Good things start close to home.",
    },
    {
        eyebrow: "DISCOVER REAL PEOPLE.",
        title: <>Real businesses.<br />Real stories.</>,
        mobileTitle: <>Discover<br />real people.<br />Real businesses.</>,
        description: "Follow your favourite shops, watch Reels, get offers and meet the people behind the places.",
        icon: Store,
        note: "Made for your neighbourhood.",
    },
    {
        eyebrow: "BETTER CHOICES.",
        title: <>Near<br />you.</>,
        mobileTitle: <>Better choices.<br />Near you.</>,
        description: "Find nearby shops, timely offers and little reasons to support local businesses.",
        icon: Heart,
        note: "A little closer, every day.",
    },
];

const demoPhotos = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=420&q=80",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=420&q=80",
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=420&q=80",
];

function MobileArtwork({ active }: { active: number }) {
    if (active === 1) {
        return (
            <div className="features-mobile-artwork features-collage" aria-hidden="true">
                <div className="features-collage-photo collage-shop" style={{ backgroundImage: `url("${demoPhotos[0]}")` }}><span><Store size={12} /> Local favourite</span></div>
                <div className="features-collage-photo collage-home" style={{ backgroundImage: `url("${demoPhotos[1]}")` }}><span><Armchair size={12} /> Made nearby</span></div>
                <div className="features-collage-photo collage-tech" style={{ backgroundImage: `url("${demoPhotos[2]}")` }} />
                <div className="features-collage-reel"><span className="reel-play">▶</span><span>Stories from<br />your street</span><Heart size={17} /></div>
                <span className="features-collage-sticker"><BadgePercent size={16} /> Local offers</span>
            </div>
        );
    }

    if (active === 2) {
        return (
            <div className="features-mobile-artwork features-benefit-list" aria-label="Nearby finds, real-time offers, directions, easy pay, local support">
                <div><span><MapPin size={19} /></span><p>Find nearby shops</p></div>
                <div><span><BadgePercent size={19} /></span><p>Get real-time offers</p></div>
                <div><span><Navigation size={19} /></span><p>Navigate easily</p></div>
                <div><span><CreditCard size={19} /></span><p>Pay with UPI</p></div>
                <div><span><Heart size={19} /></span><p>Support local businesses</p></div>
            </div>
        );
    }

    return (
        <div className="features-mobile-artwork features-discovery-art" aria-hidden="true">
            <span className="features-float-tile float-food"><Utensils size={21} /></span>
            <span className="features-float-tile float-bag"><ShoppingBag size={20} /></span>
            <span className="features-float-tile float-headphones"><Headphones size={20} /></span>
            <span className="features-float-tile float-heart"><Heart size={19} /></span>
            <div className="features-phone">
                <span className="features-phone-speaker" />
                <div className="features-phone-status"><span>9:41</span><span>● ● ▰</span></div>
                <div className="features-phone-heading"><span>NEAR YOU</span><strong>Find your<br />little corner.</strong></div>
                <div className="features-phone-map"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-spot spot-one"><Store size={12} /></span><span className="map-spot spot-two"><Utensils size={11} /></span><span className="map-spot spot-three"><MapPin size={11} /></span></div>
                <div className="features-phone-result"><span className="phone-result-mark"><Store size={15} /></span><span><strong>Good things nearby</strong><small>Shops · Offers · Stories</small></span><ArrowRight size={14} /></div>
            </div>
        </div>
    );
}

export function FeaturesSlides({ onSkip }: { onSkip?: () => void }) {
    const [active, setActive] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const slide = slides[active];
    const Icon = slide.icon;

    function move(direction: number) {
        setActive((current) => (current + direction + slides.length) % slides.length);
    }

    function nextMobileSlide() {
        if (active === slides.length - 1) onSkip?.();
        else setActive((current) => current + 1);
    }

    function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
        if (touchStartX.current === null) return;
        const distance = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (distance < -45) nextMobileSlide();
        if (distance > 45 && active > 0) setActive((current) => current - 1);
    }

    return (
        <section aria-label="Why use ZIDDU" className="features-slides">
            <div className="features-slides-orbit orbit-one" />
            <div className="features-slides-orbit orbit-two" />
            <div className="features-slides-topline"><span className="brand-lockup"><BrandLogo /></span><span className="features-slide-count">0{active + 1} / 03</span>{onSkip && <button className="features-slide-skip" onClick={onSkip} type="button">Skip</button>}</div>
            <div className="features-slides-content" key={active}>
                <span className="features-slide-icon"><Icon size={28} strokeWidth={1.8} /></span>
                <span className="section-kicker">{slide.eyebrow}</span>
                <h2>{slide.title}</h2>
                <p>{slide.description}</p>
                <div className="features-slide-points"><span><BadgePercent size={15} /> Local offers</span><span><MapPin size={15} /> Nearby finds</span><span><Heart size={15} /> Support local</span></div>
                <span className="features-slide-note">{slide.note}</span>
            </div>
            <div className="features-slides-controls"><button aria-label="Previous feature" onClick={() => move(-1)} type="button"><ArrowLeft size={17} /></button><div aria-label={`Slide ${active + 1} of ${slides.length}`} className="features-slide-dots">{slides.map((item, index) => <button aria-label={`Show slide ${index + 1}`} aria-selected={active === index} className={active === index ? "is-active" : ""} key={item.eyebrow} onClick={() => setActive(index)} role="tab" type="button" />)}</div><button aria-label="Next feature" onClick={() => move(1)} type="button"><ArrowRight size={17} /></button></div>
            <div className="features-mobile-screen" onTouchEnd={handleTouchEnd} onTouchStart={(event) => { touchStartX.current = event.changedTouches[0].clientX; }}>
                <header className="features-mobile-topbar">
                    <button aria-label={active === 0 ? "Back to login" : "Previous feature"} disabled={active === 0} onClick={() => setActive((current) => Math.max(0, current - 1))} type="button"><ArrowLeft size={19} /></button>
                    {onSkip && <button className="features-mobile-skip" onClick={onSkip} type="button">Skip</button>}
                </header>
                <div className="features-mobile-copy" key={`copy-${active}`}>
                    <h2>{slide.mobileTitle}</h2>
                    <p>{slide.description}</p>
                </div>
                <MobileArtwork active={active} />
                <footer className="features-mobile-footer">
                    <div aria-label={`Slide ${active + 1} of ${slides.length}`} className="features-mobile-dots" role="tablist">
                        {slides.map((item, index) => <button aria-label={`Show slide ${index + 1}`} aria-selected={active === index} className={active === index ? "is-active" : ""} key={item.eyebrow} onClick={() => setActive(index)} role="tab" type="button" />)}
                    </div>
                    <button className="features-mobile-next" onClick={nextMobileSlide} type="button">{active === slides.length - 1 ? "Continue" : "Next"}<ArrowRight size={17} /></button>
                </footer>
            </div>
        </section>
    );
}
