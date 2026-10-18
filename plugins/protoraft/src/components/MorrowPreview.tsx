import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlay,
  Download,
  Headphones,
  Library,
  ListMusic,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  Share2,
  Type,
  X,
} from "lucide-react";
import { useState } from "react";
import editorialImage from "../assets/morrow/editorial-bridge.webp";
import type { ScreenId } from "../types";

interface MorrowPreviewProps {
  activeScreen: ScreenId;
  bare?: boolean;
  onScreenChange: (screen: ScreenId) => void;
}

function StatusBar() {
  return (
    <div className="morrow-statusbar" aria-hidden="true">
      <svg
        viewBox="0 0 390 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="54"
          y="34"
          fill="currentColor"
          fontFamily="-apple-system, BlinkMacSystemFont, Inter, sans-serif"
          fontSize="15"
          fontWeight="600"
          letterSpacing="0"
        >
          9:41
        </text>
        <g fill="currentColor">
          <rect x="289" y="31" width="3" height="3" rx="1" />
          <rect x="294.3" y="28" width="3" height="6" rx="1" />
          <rect x="299.6" y="25" width="3" height="9" rx="1" />
          <rect x="304.9" y="22" width="3" height="12" rx="1" />
        </g>
        <g
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        >
          <path d="M315 27.5c4.8-4.3 12.2-4.3 17 0" />
          <path d="M318.2 30.9c3.1-2.7 7.7-2.7 10.8 0" />
          <path d="M322 34.2c.8-.6 1.9-.6 2.7 0" />
        </g>
        <g>
          <rect
            x="340"
            y="22"
            width="25"
            height="12"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.35"
          />
          <rect
            x="342"
            y="24"
            width="21"
            height="8"
            rx="2"
            fill="currentColor"
          />
          <path
            d="M366.5 25.9v4.2c1-.4 1.6-1.2 1.6-2.1s-.6-1.7-1.6-2.1Z"
            fill="currentColor"
            opacity="0.45"
          />
        </g>
      </svg>
    </div>
  );
}

function BottomNavigation({
  active,
  onChange,
}: {
  active: ScreenId;
  onChange: (screen: ScreenId) => void;
}) {
  return (
    <nav className="morrow-bottom-nav" aria-label="Morrow">
      <button
        type="button"
        className={active === "today" ? "is-active" : ""}
        onClick={() => onChange("today")}
      >
        <BookOpen size={20} />
        <span>Today</span>
      </button>
      <button
        type="button"
        className={active === "listen" ? "is-active" : ""}
        onClick={() => onChange("listen")}
      >
        <Headphones size={20} />
        <span>Listen</span>
      </button>
      <button
        type="button"
        className={active === "saved" ? "is-active" : ""}
        onClick={() => onChange("saved")}
      >
        <Library size={20} />
        <span>Saved</span>
      </button>
    </nav>
  );
}

function PublicationHeader() {
  return (
    <header className="morrow-publication-header">
      <button type="button" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <strong>Morrow</strong>
      <button type="button" aria-label="Search">
        <Search size={20} />
      </button>
    </header>
  );
}

function TodayScreen({
  onScreenChange,
}: {
  onScreenChange: (screen: ScreenId) => void;
}) {
  const [topic, setTopic] = useState("Today");
  return (
    <div className="morrow-screen morrow-screen--today">
      <PublicationHeader />
      <main className="morrow-scroll">
        <div className="morrow-edition">
          <span>MONDAY, JULY 28</span>
          <p>Five stories selected for a thoughtful morning.</p>
        </div>
        <div className="morrow-topics" aria-label="Topics">
          {["Today", "Ideas", "Culture", "Science"].map((item) => (
            <button
              key={item}
              type="button"
              className={topic === item ? "is-active" : ""}
              onClick={() => setTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="morrow-lead-story"
          onClick={() => onScreenChange("story")}
        >
          <img src={editorialImage} alt="Morning commuters cross a city bridge" />
          <span className="morrow-story-copy">
            <small>CITIES</small>
            <strong>A City Learning to Listen</strong>
            <p>
              What the morning commute can tell us about attention, trust, and
              public life.
            </p>
            <em>By Lena Ortiz · 8 min read</em>
          </span>
        </button>
        <section className="morrow-briefing">
          <header>
            <h2>The Briefing</h2>
            <span>4 stories</span>
          </header>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>01</span>
            <strong>The case for a slower first hour</strong>
            <small>Ideas · 5 min</small>
          </button>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>02</span>
            <strong>When public benches became a civic argument</strong>
            <small>Culture · 7 min</small>
          </button>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>03</span>
            <strong>The quiet science of shared attention</strong>
            <small>Science · 6 min</small>
          </button>
        </section>
      </main>
      <BottomNavigation active="today" onChange={onScreenChange} />
    </div>
  );
}

function StoryScreen({
  onScreenChange,
}: {
  onScreenChange: (screen: ScreenId) => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="morrow-screen morrow-screen--story">
      <header className="morrow-context-header">
        <button
          type="button"
          aria-label="Back to Today"
          onClick={() => onScreenChange("today")}
        >
          <ArrowLeft size={20} />
        </button>
        <strong>Morrow</strong>
        <button type="button" aria-label="More actions">
          <MoreHorizontal size={21} />
        </button>
      </header>
      <main className="morrow-scroll">
        <article className="morrow-article">
          <small>CITIES</small>
          <h1>A City Learning to Listen</h1>
          <p className="morrow-deck">
            What the morning commute can tell us about attention, trust, and
            public life.
          </p>
          <div className="morrow-byline">
            <span>By Lena Ortiz</span>
            <span>July 28, 2026</span>
          </div>
          <img
            className="morrow-article-image"
            src={editorialImage}
            alt="Morning commuters cross a city bridge"
          />
          <div className="morrow-article-actions">
            <button type="button" onClick={() => setSaved((value) => !value)}>
              {saved ? <Check size={18} /> : <Bookmark size={18} />}
              {saved ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={() => onScreenChange("listen")}>
              <Headphones size={18} />
              Listen
            </button>
            <button type="button" onClick={() => onScreenChange("focus")}>
              <Type size={18} />
              Focus
            </button>
            <button type="button">
              <Share2 size={18} />
              Share
            </button>
          </div>
          <div className="morrow-article-body">
            <p>
              Just after seven, the bridge begins to fill. The first wave moves
              quickly, eyes trained on the path ahead. Ten minutes later the
              pace changes, and the city seems to notice itself.
            </p>
            <p>
              Urban planners usually measure a crossing in minutes and meters.
              The people who use it describe something less exact: a place
              where the day acquires its rhythm before work begins.
            </p>
            <h2>The useful pause</h2>
            <p>
              The design did not ask commuters to slow down. It simply gave
              them reasons to look up: a wide edge, a sheltered bench, and a
              view that changes with the tide.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}

function FocusScreen({
  onScreenChange,
}: {
  onScreenChange: (screen: ScreenId) => void;
}) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [textScale, setTextScale] = useState(1);
  return (
    <div
      className="morrow-screen morrow-screen--focus"
      onClick={() => setControlsVisible((value) => !value)}
    >
      <header
        className={`morrow-focus-header ${controlsVisible ? "is-visible" : ""}`}
      >
        <button
          type="button"
          aria-label="Close focus reading"
          onClick={(event) => {
            event.stopPropagation();
            onScreenChange("story");
          }}
        >
          <X size={20} />
        </button>
        <span>42% read</span>
        <button
          type="button"
          aria-label="Reading settings"
          onClick={(event) => event.stopPropagation()}
        >
          <Settings2 size={19} />
        </button>
      </header>
      <main
        className="morrow-focus-copy"
        style={{ "--reader-scale": textScale } as React.CSSProperties}
      >
        <small>CITIES</small>
        <h1>A City Learning to Listen</h1>
        <p className="morrow-focus-intro">
          What the morning commute can tell us about attention, trust, and
          public life.
        </p>
        <p>
          Just after seven, the bridge begins to fill. The first wave moves
          quickly, eyes trained on the path ahead. Ten minutes later the pace
          changes, and the city seems to notice itself.
        </p>
        <p>
          Urban planners usually measure a crossing in minutes and meters. The
          people who use it describe something less exact: a place where the day
          acquires its rhythm before work begins.
        </p>
        <h2>The useful pause</h2>
        <p>
          The design did not ask commuters to slow down. It simply gave them
          reasons to look up: a wide edge, a sheltered bench, and a view that
          changes with the tide.
        </p>
      </main>
      <footer
        className={`morrow-focus-toolbar ${
          controlsVisible ? "is-visible" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Decrease text size"
          onClick={() => setTextScale((value) => Math.max(0.9, value - 0.1))}
        >
          A
        </button>
        <button
          type="button"
          aria-label="Increase text size"
          onClick={() => setTextScale((value) => Math.min(1.25, value + 0.1))}
        >
          <strong>A</strong>
        </button>
        <span>
          <i />
        </span>
        <button type="button" aria-label="Theme">
          <span className="theme-circle" />
        </button>
      </footer>
    </div>
  );
}

function ListenScreen({
  onScreenChange,
}: {
  onScreenChange: (screen: ScreenId) => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(36);
  const [speed, setSpeed] = useState(1);
  return (
    <div className="morrow-screen morrow-screen--listen">
      <header className="morrow-context-header">
        <button
          type="button"
          aria-label="Back"
          onClick={() => onScreenChange("story")}
        >
          <ChevronDown size={21} />
        </button>
        <strong>Now Playing</strong>
        <button type="button" aria-label="Queue">
          <ListMusic size={20} />
        </button>
      </header>
      <main className="morrow-player">
        <img src={editorialImage} alt="Morning commuters cross a city bridge" />
        <small>MORROW AUDIO</small>
        <h1>A City Learning to Listen</h1>
        <p>Lena Ortiz · 18 minutes</p>
        <label className="morrow-player-progress">
          <span className="sr-only">Playback position</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
          <span>
            <em>06:24</em>
            <em>-11:36</em>
          </span>
        </label>
        <div className="morrow-player-controls">
          <button type="button" aria-label="Rewind 15 seconds">
            <RotateCcw size={25} />
            <span>15</span>
          </button>
          <button
            type="button"
            className="morrow-play-button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" />
            )}
          </button>
          <button type="button" aria-label="Forward 30 seconds">
            <RotateCw size={25} />
            <span>30</span>
          </button>
        </div>
        <div className="morrow-player-options">
          <button
            type="button"
            onClick={() =>
              setSpeed((value) =>
                value === 1 ? 1.25 : value === 1.25 ? 1.5 : 1,
              )
            }
          >
            {speed}x
          </button>
          <button type="button">
            <Download size={18} />
            Download
          </button>
        </div>
        <button
          type="button"
          className="morrow-open-article"
          onClick={() => onScreenChange("story")}
        >
          <BookOpen size={18} />
          Open written story
        </button>
      </main>
      <BottomNavigation active="listen" onChange={onScreenChange} />
    </div>
  );
}

function SavedScreen({
  onScreenChange,
}: {
  onScreenChange: (screen: ScreenId) => void;
}) {
  const [filter, setFilter] = useState("All");
  return (
    <div className="morrow-screen morrow-screen--saved">
      <PublicationHeader />
      <main className="morrow-scroll">
        <header className="morrow-library-heading">
          <span>
            <h1>Saved</h1>
            <p>7 stories</p>
          </span>
          <button type="button" aria-label="More options">
            <MoreHorizontal size={21} />
          </button>
        </header>
        <div className="morrow-library-filters">
          {["All", "Unread", "Downloaded"].map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "is-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <section className="morrow-progress-story">
          <span>CONTINUE READING · 42%</span>
          <button type="button" onClick={() => onScreenChange("story")}>
            <img src={editorialImage} alt="" />
            <span>
              <strong>A City Learning to Listen</strong>
              <small>Lena Ortiz · 5 min left</small>
              <i>
                <em />
              </i>
            </span>
          </button>
        </section>
        <section className="morrow-saved-list">
          <h2>Recently saved</h2>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>
              <small>IDEAS</small>
              <strong>The case for a slower first hour</strong>
              <em>5 min read</em>
            </span>
            <Bookmark size={18} fill="currentColor" />
          </button>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>
              <small>CULTURE</small>
              <strong>When public benches became a civic argument</strong>
              <em>7 min read</em>
            </span>
            <Bookmark size={18} fill="currentColor" />
          </button>
          <button type="button" onClick={() => onScreenChange("story")}>
            <span>
              <small>SCIENCE</small>
              <strong>The quiet science of shared attention</strong>
              <em>6 min read</em>
            </span>
            <Bookmark size={18} fill="currentColor" />
          </button>
        </section>
      </main>
      <BottomNavigation active="saved" onChange={onScreenChange} />
    </div>
  );
}

export function MorrowPreview({
  activeScreen,
  bare = false,
  onScreenChange,
}: MorrowPreviewProps) {
  return (
    <div className={`morrow-phone ${bare ? "morrow-phone--bare" : ""}`}>
      <StatusBar />
      {activeScreen === "today" && (
        <TodayScreen onScreenChange={onScreenChange} />
      )}
      {activeScreen === "story" && (
        <StoryScreen onScreenChange={onScreenChange} />
      )}
      {activeScreen === "focus" && (
        <FocusScreen onScreenChange={onScreenChange} />
      )}
      {activeScreen === "listen" && (
        <ListenScreen onScreenChange={onScreenChange} />
      )}
      {activeScreen === "saved" && (
        <SavedScreen onScreenChange={onScreenChange} />
      )}
    </div>
  );
}
