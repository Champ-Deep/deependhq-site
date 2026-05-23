// app.jsx — the homepage entry.

const { useState, useEffect } = React;

const App = () => {
  const [active, setActive] = useState('now');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onBook = () => {
      setToast({ msg: `opening ${window.DH_DATA.brand.booking_url} …` });
      setTimeout(() => setToast(null), 2600);
    };
    window.addEventListener('dh:book', onBook);
    return () => window.removeEventListener('dh:book', onBook);
  }, []);

  // Track which section is in view for nav highlight
  useEffect(() => {
    const map = { hero: 'now', now: 'now', think: 'now', ecosystem: 'now', proof: 'now', book: 'now' };
    const ids = Object.keys(map);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(map[e.target.id] || 'now');
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const onBook = () => window.dispatchEvent(new CustomEvent('dh:book'));

  return (
    <div className="dh-app">
      <Nav active={active} />
      <Hero onBook={onBook} />
      <Ticker />
      <ShippingNow />
      <StatusBoard />
      <HowIThink />
      <Ecosystem />
      <Proof />
      <TheStack />
      <Dispatch />
      <SecondCTA onBook={onBook} />
      <Footer />
      {toast && (
        <div className="dh-toast">
          <span className="dh-toast-gt">&gt;_</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
