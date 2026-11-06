import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { About, StackRow } from "@/components/landing/about";
import { Features } from "@/components/landing/features";
import { Teams } from "@/components/landing/teams";
import { Agents } from "@/components/landing/agents";
import { Cta, Faq, Footer } from "@/components/landing/closing";
import { SmoothWindow } from "@/components/ui/smooth-scroll";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <SmoothWindow />
      <div className="bg-paper">
        <Navbar />
      </div>
      <Hero />
      <StackRow />
      <About />
      <Features />
      <Teams />
      <Agents />
      <Faq />
      <Cta />
      <Footer />
    </main>
  );
}
