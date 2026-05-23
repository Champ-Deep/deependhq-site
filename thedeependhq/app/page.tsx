import Nav from "./components/Nav";
import Hero from "./components/Hero";
import ShippingNow from "./components/ShippingNow";
import HowIThink from "./components/HowIThink";
import Ecosystem from "./components/Ecosystem";
import Proof from "./components/Proof";
import SecondCTA from "./components/SecondCTA";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ShippingNow />
        <HowIThink />
        <Ecosystem />
        <Proof />
        <SecondCTA />
      </main>
      <Footer />
    </>
  );
}
