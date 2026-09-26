// app.jsx : the homepage entry. Sep 2026 system.
// Reading order: identity + today, the log, the stack, the twelve, writing, ways in.

const App = () => {
  const H = window.HomeSections;
  return (
    <div className="dh-app">
      <Nav active="home" />
      <main id="main">
        <H.HeroBento />
        <div className="wrap"><div className="gutter" /></div>
        <H.LogStrip />
        <H.StackNow />
        <H.Companies />
        <div className="wrap"><div className="gutter" /></div>
        <H.Writing />
        <H.WaysIn />
      </main>
      <Footer />
      {window.CommandPalette && React.createElement(window.CommandPalette)}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
