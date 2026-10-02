// PrivacyPage.jsx : what the site records, in the site's own voice.
//
// WHY THIS PAGE EXISTS
// The footer says "no cookies, no trackers". Since the site started recording
// its own events, that sentence needed a page behind it. A privacy policy that
// lists things nobody checks is worse than none, so this one states the exact
// fields, where they go, and the one thing deliberately not collected.
//
// REVISED 2026-10-02, AND THE REVISION IS THE POINT
// The first version of this page promised no cookie and no visitor id, and it was
// true when written. Then Deep chose full visitor profiles, because telling a
// returning reader from a new one is the difference between "forty people read
// three essays" and "forty pageviews". So this page was rewritten in the same
// change as the code.
//
// A privacy page that drifts away from the behaviour is the only genuinely
// indefensible thing here, so the specific claims below are asserted by
// scripts/selftest-privacy.mjs against visitor-id.js and analytics.js.

const PrivacyPage = () => {
  return (
    <main className="dh-page sys mode-operator" id="main">
      <div className="wrap" style={{ maxWidth: '72ch' }}>
        <header className="page-head">
          <span className="eyebrow">privacy</span>
          <h1>What this site records, and what it refuses to.</h1>
          <p className="lead">
            I run this site to learn what is actually useful to people, not to build a profile of
            anyone. So the list below is short on purpose. It is the whole list, not a summary of
            a longer one.
          </p>
        </header>

        <section aria-labelledby="rec-h" style={{ marginBottom: 'var(--s10)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s5)' }}>
            <div>
              <span className="eyebrow">recorded</span>
              <h2 id="rec-h">Eight things, on my own server.</h2>
            </div>
          </div>
          <ul className="dh-list" style={{ display: 'grid', gap: 'var(--s4)', padding: 0, listStyle: 'none' }}>
            <li>
              <b>Which page.</b> The path, like <code>/post/week-44-the-discipline-arc/</code>.
              Not the full URL with its query string.
            </li>
            <li>
              <b>Where you came from.</b> The hostname of the referrer, and only when it is a
              different site. Not the full referring URL, which routinely carries campaign strings.
            </li>
            <li>
              <b>Country and timezone.</b> Coarse fields Cloudflare already resolved from the
              connection. Used for a clock greeting and for knowing where the readers are.
            </li>
            <li>
              <b>How far you read.</b> Scroll depth at the 25, 50, 75 and 100 percent marks, and
              how many seconds the tab was open.
            </li>
            <li>
              <b>What you clicked.</b> Outbound links, labelled by destination: github, linkedin,
              bluesky, book a call, a client site. And which calls to action on this site you used.
            </li>
            <li>
              <b>Screen size bucket.</b> Small, medium, large or extra large. Not the exact pixel
              width, because an exact width starts to be a fingerprint when combined with
              everything else.
            </li>
            <li>
              <b>A random id, and what you did under it.</b> A random string is generated on your
              first visit and kept in a first-party cookie called <code>dh_vid</code>, so I can
              tell a returning reader from a new one. It expires after 180 days. It identifies a
              browser, never a person. Before it is stored it is hashed, so the dataset holds
              "these 40 ids" and not the ids themselves.
            </li>
            <li>
              <b>What that browser found interesting.</b> Which pages it read furthest, which
              calls to action it used, and whether it came back. This is the profile, and it lives
              in your browser's own local storage, not on my server.
            </li>
          </ul>
        </section>

        <section aria-labelledby="not-h" style={{ marginBottom: 'var(--s10)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s5)' }}>
            <div>
              <span className="eyebrow">not recorded</span>
              <h2 id="not-h">What I refuse to collect.</h2>
            </div>
          </div>
          <ul className="dh-list" style={{ display: 'grid', gap: 'var(--s4)', padding: 0, listStyle: 'none' }}>
            <li>
              <b>No account, no login, no name.</b> There is no way for me to link any of this to
              you as a person, and no way for you to be found.
            </li>
            <li>
              <b>No third-party cookies and no cross-site tracking.</b> The one cookie this site
              sets is first-party, so it is never sent anywhere but here. Nothing on this page
              reads or writes storage on another origin.
            </li>
            <li>
              <b>No fingerprint.</b> No canvas hash, no font enumeration, no audio stack, no
              hardware timings.
            </li>
            <li>
              <b>No IP address stored.</b> The connection address routes the request and is not
              written to anything I can read. Cloudflare does resolve a country from it, and that
              two-letter country code is what I keep, not the address behind it.
            </li>
            <li>
              <b>No third-party analytics script.</b> PostHog, Google Analytics and Segment are all
              deliberately absent. The events go to a Cloudflare database on this site and nowhere
              else.
            </li>
            <li>
              <b>No ad targeting, no sale, no sharing.</b> Nothing here is sold, shared, or handed
              to an ad network.
            </li>
            <li>
              <b>No selling you a different page based on who you are.</b> This site sorts a
              visitor into one of three coarse groups, operator, narrative, or explorer, from
              where they arrived and what they read. It changes emphasis in the wording, and that
              is all. It never changes a fact, a number, or a date on this site, and the group it
              puts you in is not a profile: it is recomputed from scratch on every visit. One of
              those three groups deliberately gets no change at all, so I can honestly tell
              whether the other two are doing anything.
            </li>
            <li>
              <b>No asking twice.</b> The site may ask you one question about whether it worked for
              you. Once, ever, on one article, only after you have read most of it, and never
              anyone who has already booked a call. Saying no is recorded as a real answer, and so
              is closing it without a word.
            </li>
          </ul>
        </section>

        <section aria-labelledby="third-h" style={{ marginBottom: 'var(--s10)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s5)' }}>
            <div>
              <span className="eyebrow">the exception</span>
              <h2 id="third-h">The chat widget does use cookies.</h2>
            </div>
          </div>
          <p>
            The "Ask Deep" assistant in the corner is run by Widgo, a third party, and it has its own
            storage and its own policy. I can see that you opened it. I cannot see what you typed to
            it, and I do not want to: that is between you and them, under
            {' '}
            <a className="dh-link" href="https://www.widgo.ai/legal/cookie-policy" target="_blank" rel="noopener noreferrer">
              their cookie policy
            </a>
            . The widget is the only thing on this page that sets a cookie.
          </p>
        </section>

        <section aria-labelledby="why-h" style={{ marginBottom: 'var(--s10)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s5)' }}>
            <div>
              <span className="eyebrow">why</span>
              <h2 id="why-h">Why measure at all.</h2>
            </div>
          </div>
          <p>
            Because I would otherwise be guessing. Fifteen essays and a log nobody reads is a hobby,
            and the difference between a site that compounds and one that does not is usually a
            handful of facts I could not have predicted. Knowing which pages get read to the bottom,
            and which links get followed, is the cheapest honest way to find out what to write next.
          </p>
          <p>
            The trade is real, so here it is without softening. You get the numbers. I get a
            durable id, a coarse reading of what interests you, and the ability to tell the two
            apart. If that trade is not one you want to make, there are three ways out, and all
            three are one click or one line.
          </p>
          <ul className="dh-list" style={{ display: 'grid', gap: 'var(--s3)', padding: 0, listStyle: 'none' }}>
            <li>
              <b>Delete everything.</b> Clear this site's data in your browser and the profile is
              gone with it. The server-side history stays, and asking below gets it removed too.
            </li>
            <li>
              <b>Read without measuring.</b> Every page on this site renders its full content with
              JavaScript switched off. You lose nothing to read.
            </li>
            <li>
              <b>Ask for the raw rows.</b> I will show you exactly what is stored, or delete the
              dataset. It is one email and I have done it before.
            </li>
          </ul>
        </section>

        <section aria-labelledby="ask-h">
          <div className="section-head" style={{ marginBottom: 'var(--s5)' }}>
            <div>
              <span className="eyebrow">ask</span>
              <h2 id="ask-h">Want the raw data or something deleted?</h2>
            </div>
          </div>
          <p>
            The events are stored in a Cloudflare Analytics Engine dataset called{' '}
            <code>deependhq_events</code>, and I can query it directly. Ask and I will show you the
            rows, or delete the dataset outright.
          </p>
          <p>
            If you want to send me your <code>dh_vid</code> I will find and remove every row that
            carries it, which is why the id is hashed before it is written rather than stored
            plainly. That is a real limitation and I would rather state it than let you assume the
            delete was exact.
          </p>
          <p>
            <a className="dh-link" href="mailto:deep@championsmail.com">deep@championsmail.com</a>
          </p>
        </section>
      </div>
    </main>
  );
};

window.PrivacyPage = PrivacyPage;
