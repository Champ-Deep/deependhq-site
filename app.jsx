// app.jsx : the homepage entry. Oct 2026, "The Window".
// Reading order follows the working window: identity at 15:00, the numbers,
// how a day becomes an entry, the log, the stack, the four pillars, writing,
// off the clock, three doors, the 02:00 sign-off, and the paper band.
//
// index.html no longer loads React or Babel. scripts/prerender.mjs renders
// <App /> to static HTML at build time and home.js adds the interaction. The
// mount line below stays for anyone who loads the JSX by hand; prerender strips it.

const App = () => {
  const H = window.HomeSections;
  return (
    <div className="dh-app home-wx v5-home">
      <Nav active="home" progress />
      <main id="main" className="wx-main">
        <H.Hero />

        <H.Stack />
        <H.Pillars />
        <H.Call />
        <H.Log />
        <H.Writing />
        <H.Human />
        <H.Day />
        <H.Machine />
        <H.Doors />
      </main>
      <H.Signoff />

      <Footer compact />
      {window.CommandPalette && React.createElement(window.CommandPalette)}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
