import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Ticker } from "@/components/landing/Ticker";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Stats } from "@/components/landing/Stats";
import { Features } from "@/components/landing/Features";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";
import { CtaSection } from "@/components/landing/CtaSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main style={{ background: "var(--bg)" }} className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <Ticker />
      <HowItWorks />
      <Stats />
      <Features />
      <Pricing />
      <Faq />
      <CtaSection />
      <Footer />
    </main>
  );
}
