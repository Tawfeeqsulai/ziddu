"use client";

import { useState } from "react";
import { FeaturesSlides } from "@/components/features/auth/features-slides";
import PhoneLoginForm from "@/components/features/auth/phone-login-form";

type LoginExperienceProps = {
    developmentOtp?: string;
};

export default function LoginExperience({ developmentOtp }: LoginExperienceProps) {
    const [showMobileFeatures, setShowMobileFeatures] = useState(true);

    return (
        <main className={`login-page${showMobileFeatures ? " mobile-features-active" : ""}`}>
            <section className="login-form-panel">
                <PhoneLoginForm developmentOtp={developmentOtp} />
            </section>
            <FeaturesSlides onSkip={() => setShowMobileFeatures(false)} />
        </main>
    );
}
