import { PUBLIC_OBJECTIVES } from '../../data/objectives'
import { POST_IDS, POSTS } from '../../data/posts'
import { navigate } from '../route'
import '../setup.css'
import '../rules.css'
import type { ReactNode } from 'react'

/** A framed panel with the lobby's gold tab, the tab carrying the section heading. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="box sect">
      <div className="frame panel">{children}</div>
      <h2 className="tab">{title}</h2>
    </section>
  )
}

/** One difference, under a condensed gold label. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grp">
      <div className="lbl"><i className="dia" />{label}</div>
      {children}
    </div>
  )
}

export function RulesScreen() {
  return (
    <div className="rules lobbyui" data-testid="rules-screen">
      <div className="space">
        <div className="base" /><div className="stars" /><div className="galaxy a" /><div className="galaxy b" />
        <div className="veil" /><div className="dust" /><div className="limb" /><div className="vig" />
      </div>

      <div className="doc">
        <header className="hero">
          <h1 className="title goldtext">Rules</h1>
          <div className="rule"><span /><i className="dia" /><span /></div>
          <p className="tagline">Twilight Imperium for two players, thirty minutes</p>
          <button type="button" className="btn ghost sm" data-testid="btn-back-to-lobby" onClick={() => navigate('#/')}>
            Back to the lobby
          </button>
        </header>

        <Section title="The short version">
          <p>
            Two players, seven systems, Mecatol Rex in the middle. The first player to 7 victory points wins.
            If nobody gets there, the higher score after round 6 wins.
          </p>
          <p>
            Each player has fifteen minutes on a chess clock, and you can set that number in the lobby before
            you start.
          </p>
          <p>
            Mecatol Duel is a fan project built on the Twilight Imperium 4 base game. This page is not a
            rulebook. It lists what the duel changes, where the victory points come from and how the clock
            works. Everything it does not mention works as it does in the base game.
          </p>
        </Section>

        <Section title="What is different from Twilight Imperium">
          <Group label="Map and factions">
            <p>
              Seven systems instead of a galaxy you build. The map is fixed, it is called Bereg Standoff, and
              the home systems sit north and south. Version 1 has two factions, the L1Z1X Mindnet and the
              Barony of Letnev, with their printed starting units, starting technologies, faction abilities,
              flagships and faction technologies.
            </p>
          </Group>

          <Group label="Mecatol Rex">
            <p>
              No Custodians token, so there are no 6 influence to pay. A neutral guardian fleet worth 8
              resources plus 2 infantry holds the planet, and a fresh fleet is rolled in the status phase of
              every round in which nobody controls Mecatol Rex. Holding Mecatol Rex scores 1 victory point in
              every status phase, not once.
            </p>
          </Group>

          <Group label="Strategy cards">
            <p>
              Six cards, Leadership, Diplomacy, Trade, Warfare, Technology and Imperial.
              {' '}<b>There is no Construction and no Politics.</b> The draft is a snake, the speaker picks
              one card, the opponent picks two, the speaker takes the last one. The two cards nobody took each
              collect a trade good, and whoever picks such a card later takes the trade goods with it.
            </p>
            <p>
              The Imperial secondary gives 2 trade goods instead of a secret objective. Diplomacy uses the
              errata text. You choose a system other than Mecatol Rex in which you control a planet, your
              opponent puts a command token there and can no longer activate it this round, and then you ready
              up to two of your exhausted planets.
            </p>
          </Group>

          <Group label="Structures">
            <p>
              Without Construction there is no way to build a PDS, and there is no PDS II technology. Each side
              starts with the space dock its faction prints, and the L1Z1X also start with a PDS. If you ever
              hold no space dock at all, one emergency shipyard per game gets you back in. It is a component
              action, one strategy token and 4 resources, and it places a dock on a planet you control.
            </p>
          </Group>

          <Group label="Technology">
            <p>
              The full base tech tree, minus PDS II and minus the War Sun technology. A War Sun needs no
              research here: you may build one from the first round, and it costs 12. Inheritance Systems
              works as the L1Z1X component action. Exhaust it, spend 2 resources, ignore the prerequisites.
            </p>
          </Group>

          <Group label="Combat">
            <p>
              Both sides roll at the same time, and then each player assigns the hits their own fleet takes.
              Sustain damage is your decision, not the engine's: you may take a hit on an undamaged
              dreadnought, war sun or flagship instead of losing a ship. Hits that must go to a non-fighter
              ship still do, and when there is nothing to decide the engine resolves the hits for you.
            </p>
          </Group>

          <Group label="Objectives">
            <p>
              No secret objectives. Six public objectives are revealed one per round in a fixed order, and both
              players can score each of them once. On top of that there is one open shared objective, the
              Mandate <b>First Strike</b>. Win a space combat in the Mecatol Rex system or in your opponent
              {"'"}s home system and it is worth 1 victory point, once per player. Because it is open, both of
              you always know what the other is playing for.
            </p>
          </Group>

          <Group label="Trade posts">
            <p>
              Two neutral posts are in play at a time, west and east, and a new pair is rolled every round. On
              your own turn, once per round per post, you may sell commodities for one trade good each, as
              long as you control a planet in one of the systems linked to that post. The posts are not
              systems. Nothing moves there and nothing fights there. All six posts, their pictures and their
              abilities are below, under Trade posts.
            </p>
          </Group>

          <Group label="Not in this version">
            <p>Action cards, promissory notes, the agenda phase and secret objectives.</p>
          </Group>
        </Section>

        <Section title="Trade posts">
          <p>
            Every round rolls two of them, one west and one east, drawn from the four that were not in play
            the round before, so the same pair cannot come right back immediately. An ability nobody used
            goes with the post when it turns over, that pressure is deliberate. Selling commodities is once
            per round per player. A post{"'"}s special ability is once per round for the table, whoever gets
            there first.
          </p>
          <div className="posts">
            {POST_IDS.map(id => {
              const post = POSTS[id]
              return (
                <div className="postrow" key={id}>
                  <img className="art" src={post.art} alt={post.name} />
                  <div className="body">
                    <div className="name">{post.name}</div>
                    <div className="limit">Sells up to {post.commodityLimit} commodities</div>
                    <p className="ability">
                      {post.abilityName ? <b>{post.abilityName}. </b> : null}
                      {post.abilityText}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Victory points">
          <p>Points come from four places.</p>
          <ul className="pts">
            <li><span><b>Public objectives.</b> Six of them, 1 point each, scored once per player in a status phase.</span></li>
            <li><span><b>The Mandate.</b> 1 point, once per player.</span></li>
            <li><span><b>Mecatol Rex.</b> 1 point in every status phase in which you control the planet.</span></li>
            <li><span><b>The Imperial primary.</b> 1 point at once if you control Mecatol Rex when you play it.</span></li>
          </ul>
          <p className="after">
            The victory check runs at the end of every status phase, and 7 points wins it. If nobody has
            reached 7 after the round 6 status phase, the higher score wins. A tie goes to whoever holds
            Mecatol Rex, then to whoever controls more planets, then to the speaker{"'"}s opponent.
          </p>
          <p>The public objectives. One is revealed per round, in an order the game shuffles at setup:</p>
          <ol className="objlist">
            {PUBLIC_OBJECTIVES.map(objective => (
              <li key={objective.id}>
                <span>{objective.text}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="The clock">
          <p>
            Fifteen minutes each, and you set that number in the lobby. Your clock runs whenever the game is
            waiting on a decision of yours, in every phase, drafting a card, taking an action, answering a
            secondary, distributing status tokens. It stops while the handoff screen is up and once the game
            is over.
          </p>
          <p>
            <b>Running out of time does not lose you the game.</b> At zero you automatically pass for the rest
            of the round, and you get three more minutes at the start of each later round.
          </p>
          <p>
            So if you are ahead on points and your opponent runs out of time before they can catch up, you win
            on points. The clock only takes turns away, never the game.
          </p>
        </Section>

        <Section title="Music">
          <p>
            Three tracks play in rotation while you think: <b>Lightless Dawn</b>, <b>Interloper</b> and
            <b> Impact Andante</b>, all by <b>Kevin MacLeod</b> (incompetech.com). They are licensed under
            Creative Commons By Attribution 4.0, <a href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank" rel="noreferrer">creativecommons.org/licenses/by/4.0</a>, and are used here
            re-encoded at a lower bitrate so they load quickly. Nothing else about them was changed.
          </p>
          <p>You can switch the music off in the lobby or in the game menu; the choice is remembered.</p>
        </Section>

        <div className="back">
          <button type="button" className="btn ghost" data-testid="btn-back-to-lobby-foot" onClick={() => navigate('#/')}>
            Back to the lobby
          </button>
        </div>

        <p className="legal">
          Fan project. Twilight Imperium and its artwork belong to Fantasy Flight Games. Unit, tile and card images via AsyncTI4.
          {' '}Music by Kevin MacLeod (incompetech.com), licensed under Creative Commons By Attribution 4.0, re-encoded for the web.
        </p>
      </div>
    </div>
  )
}
