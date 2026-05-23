// page.jsx — shared entry point for inner pages (journey, toolkit, field-notes).
// Renders <Nav> + the chosen page body + <Footer>. Determined by data-page attribute on #root.

const { useState: useStateP, useEffect: useEffectP } = React;

const PageShell = ({ pageId }) => {
  const [toast, setToast] = useStateP(null);

  useEffectP(() => {
    const onBook = () => {
      setToast({ msg: `opening ${window.DH_DATA.brand.booking_url} …` });
      setTimeout(() => setToast(null), 2600);
    };
    window.addEventListener('dh:book', onBook);
    return () => window.removeEventListener('dh:book', onBook);
  }, []);

  let Body = null;
  if (pageId === 'journey')     Body = <JourneyPage />;
  else if (pageId === 'toolkit') Body = <ToolkitPage />;
  else if (pageId === 'field-notes') Body = <FieldNotesPage />;

  return (
    <div className="dh-app">
      <Nav active={pageId} />
      {Body}
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

const root = document.getElementById('root');
const pageId = root.dataset.page;
ReactDOM.createRoot(root).render(<PageShell pageId={pageId} />);
