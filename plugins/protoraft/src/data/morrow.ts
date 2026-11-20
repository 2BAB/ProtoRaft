import focusImage from "../assets/morrow/focus.webp";
import listenImage from "../assets/morrow/listen.webp";
import savedImage from "../assets/morrow/saved.webp";
import storyImage from "../assets/morrow/story.webp";
import todayImage from "../assets/morrow/today.webp";
import type { PrototypeProject } from "../types";

const productBrief = `# Morrow v0.1 product brief

## Product idea

Morrow is a calm daily magazine for people who want depth without an endless feed. Each edition gives readers a deliberate starting point, then supports three useful outcomes: read with focus, listen while moving, or save for later.

## Audience

- Curious readers who value edited context over volume
- Commuters who move between reading and listening
- Subscribers who return to a small personal library

## Release goal

Validate one connected editorial journey before expanding the product:

~~~mermaid
flowchart LR
  A[Today] -->|Open lead story| B[Story]
  B -->|Enter focus mode| C[Focus reading]
  B -->|Play audio| D[Now Playing]
  B -->|Save story| E[Saved]
~~~

## Product principles

1. One clear editorial choice beats an infinite list.
2. Reading controls stay quiet until they are needed.
3. Audio and text are two modes of the same story.
4. Saving is a promise to help the reader return, not a storage bin.

## In scope

| Capability | v0.1 behavior |
| --- | --- |
| Daily edition | One lead story and a short ordered briefing |
| Story reading | Standard article page and focus mode |
| Audio | One story player with speed and queue controls |
| Saved library | Save, remove, filter, and resume |
| Continuity | Reading and listening progress persist locally |

## Not in scope

- Open-ended social feeds or comments
- Publisher tooling and editorial CMS workflows
- Recommendations based on behavioral profiling
- Full subscription checkout
- Offline audio downloads across multiple devices

## Success signals

- Readers open at least one story from Today.
- Readers reach 50 percent of a story in reading or listening mode.
- Saved stories are resumed within seven days.
- Readers can explain the difference between standard and focus reading without instruction.`;

const interactionSpec = `# Morrow v0.1 interaction spec

## Navigation model

Today, Listen, and Saved are top-level destinations. Story and Focus reading are contextual destinations that preserve their entry point.

~~~mermaid
stateDiagram-v2
  [*] --> Today
  Today --> Story: tap story
  Story --> Focus: tap focus
  Focus --> Story: close
  Story --> Listen: tap listen
  Listen --> Story: open article
  Story --> Saved: save then view library
  Saved --> Story: resume
~~~

## Today

- Tapping a topic filters the briefing in place and keeps the lead story visible.
- Tapping a story opens Story and preserves the current edition position.
- Pull to refresh checks for a new edition while existing content stays visible.

## Story

- Save changes state immediately and confirms with a short inline status.
- Listen opens Now Playing at the matching story position.
- Focus opens a reduced reader and inherits text size and theme.
- Back returns to the exact entry surface.

## Focus reading

- A single tap reveals or hides the reading toolbar.
- Text size changes reflow content without losing paragraph position.
- The progress indicator updates by section, not by raw pixel scroll.

## Now Playing

- Play and pause never change layout dimensions.
- Scrubbing updates elapsed time continuously and commits on release.
- Closing the full player leaves a persistent mini player until playback ends.

## Saved

- Unfinished items appear before unread items.
- Removing an item is reversible during the current session.
- The empty state keeps a direct route back to Today.

## Accessibility baseline

- Controls have text alternatives and a minimum 44 by 44 point target.
- Reading text supports dynamic type without horizontal scrolling.
- Progress and selected states are communicated by more than color alone.
- Reduce Motion removes spatial transitions while preserving state feedback.`;

export const morrowProject: PrototypeProject = {
  projectId: "morrow-v0.1",
  name: "Morrow",
  repositoryName: "Morrow",
  version: "0.1",
  summary: "A calm daily magazine for deliberate reading and listening.",
  defaultBranch: "main",
  screens: [
    {
      id: "today",
      title: "Today",
      route: "/today",
      summary: "Daily edition and lead story",
      purpose:
        "Give the reader one clear starting point plus a compact scan of the day's edition.",
      image: todayImage,
      stage: "approved",
      position: { x: 40, y: 210 },
      entry: ["App launch", "Today in bottom navigation"],
      actions: [{ label: "Open lead story", target: "story" }],
      states: ["Default", "Topic filtered", "Offline cache"],
      linkedDocumentIds: ["product-brief", "interaction-spec"],
      updatedAt: "Today, 09:42",
    },
    {
      id: "story",
      title: "Story",
      route: "/story/a-city-learning-to-listen",
      summary: "Article hub and reading actions",
      purpose:
        "Help readers understand the story and choose standard reading, focus, audio, or save.",
      image: storyImage,
      stage: "approved",
      position: { x: 380, y: 210 },
      entry: ["Story card", "Shared story link"],
      actions: [
        { label: "Enter focus mode", target: "focus" },
        { label: "Play audio", target: "listen" },
        { label: "Save story", target: "saved" },
      ],
      states: ["Default", "Saved", "Audio available", "Member preview"],
      linkedDocumentIds: ["product-brief", "interaction-spec"],
      updatedAt: "Today, 09:38",
    },
    {
      id: "focus",
      title: "Focus reading",
      route: "/story/a-city-learning-to-listen/focus",
      summary: "Distraction-reduced reader",
      purpose:
        "Create a quiet reading surface with only progress and typography controls.",
      image: focusImage,
      stage: "review",
      position: { x: 730, y: 10 },
      entry: ["Focus action on Story"],
      actions: [{ label: "Exit focus mode", target: "story" }],
      states: ["Default", "Controls visible", "Progress restored"],
      linkedDocumentIds: ["product-brief", "interaction-spec"],
      updatedAt: "Yesterday, 18:12",
    },
    {
      id: "listen",
      title: "Now Playing",
      route: "/listen/a-city-learning-to-listen",
      summary: "Full story audio player",
      purpose:
        "Offer a focused audio experience with a direct route back to the written story.",
      image: listenImage,
      stage: "review",
      position: { x: 730, y: 315 },
      entry: ["Listen action on Story", "Mini player"],
      actions: [{ label: "Open written story", target: "story" }],
      states: ["Paused", "Playing", "Speed changed", "Queue expanded"],
      linkedDocumentIds: ["product-brief", "interaction-spec"],
      updatedAt: "Yesterday, 17:48",
    },
    {
      id: "saved",
      title: "Saved",
      route: "/saved",
      summary: "Personal reading library",
      purpose:
        "Help readers resume unfinished stories and manage a useful personal list.",
      image: savedImage,
      stage: "approved",
      position: { x: 730, y: 620 },
      entry: ["Saved in bottom navigation", "Save action on Story"],
      actions: [{ label: "Resume story", target: "story" }],
      states: ["Default", "Empty", "Downloaded", "Filtered"],
      linkedDocumentIds: ["product-brief", "interaction-spec"],
      updatedAt: "Monday, 14:20",
    },
  ],
  connections: [
    {
      id: "today-story",
      source: "today",
      target: "story",
      label: "Open lead story",
    },
    {
      id: "story-focus",
      source: "story",
      target: "focus",
      label: "Focus",
    },
    {
      id: "story-listen",
      source: "story",
      target: "listen",
      label: "Listen",
    },
    {
      id: "story-saved",
      source: "story",
      target: "saved",
      label: "Save",
    },
  ],
  discussions: [
    {
      id: "note_story_audio",
      screenId: "story",
      author: "Mina",
      body: "Keep Listen in the first action row. Audio is a core route, not an overflow action.",
      createdAt: "2026-07-28T09:46:00.000Z",
    },
    {
      id: "note_story_focus",
      screenId: "story",
      author: "Theo",
      body: "Focus mode should inherit the reader's text size and return to the same paragraph.",
      createdAt: "2026-07-28T09:51:00.000Z",
    },
  ],
  documents: [
    {
      id: "product-brief",
      title: "Product brief",
      filename: "documents/product-brief.md",
      summary: "Product idea, scope, principles, and success signals",
      content: productBrief,
      screenIds: ["today", "story", "focus", "listen", "saved"],
      updatedAt: "Today, 10:06",
      status: "review",
    },
    {
      id: "interaction-spec",
      title: "Interaction spec",
      filename: "documents/interaction-spec.md",
      summary: "Navigation, states, continuity, and accessibility",
      content: interactionSpec,
      screenIds: ["today", "story", "focus", "listen", "saved"],
      updatedAt: "Today, 09:58",
      status: "draft",
    },
  ],
  tokens: [
    {
      path: "color.paper",
      group: "Color",
      value: "#FCFDFE",
      swatch: "#FCFDFE",
      description: "Primary editorial background",
    },
    {
      path: "color.ink",
      group: "Color",
      value: "#171A1A",
      swatch: "#171A1A",
      description: "Primary content and controls",
    },
    {
      path: "color.muted",
      group: "Color",
      value: "#6D6D6D",
      swatch: "#6D6D6D",
      description: "Secondary copy and metadata",
    },
    {
      path: "color.line",
      group: "Color",
      value: "#E5E7EB",
      swatch: "#E5E7EB",
      description: "Dividers and quiet outlines",
    },
    {
      path: "color.signal",
      group: "Color",
      value: "#4095C6",
      swatch: "#4095C6",
      description: "Selected and active states",
    },
    {
      path: "font.editorial",
      group: "Typography",
      value: "Georgia",
      description: "Story headlines and reading text",
    },
    {
      path: "font.interface",
      group: "Typography",
      value: "Inter",
      description: "Navigation, controls, and metadata",
    },
    {
      path: "space.4",
      group: "Space",
      value: "16px",
      description: "Default content rhythm",
    },
    {
      path: "space.6",
      group: "Space",
      value: "24px",
      description: "Section separation",
    },
    {
      path: "radius.control",
      group: "Radius",
      value: "6px",
      description: "Interactive controls",
    },
    {
      path: "radius.surface",
      group: "Radius",
      value: "8px",
      description: "Content surfaces",
    },
  ],
  components: [
    {
      id: "publication-header",
      name: "Publication header",
      category: "Navigation",
      variants: ["Root", "Contextual"],
      states: ["Default", "Scrolled"],
      platforms: ["Web", "iOS", "Android"],
      description: "Masthead, date, and contextual actions.",
    },
    {
      id: "topic-filter",
      name: "Topic filter",
      category: "Input",
      variants: ["Text", "Compact"],
      states: ["Idle", "Selected", "Pressed", "Focus visible"],
      platforms: ["Web", "iOS", "Android"],
      description: "A quiet single-select topic control.",
    },
    {
      id: "story-card",
      name: "Story card",
      category: "Content",
      variants: ["Lead", "Brief", "Saved"],
      states: ["Default", "Saved", "Downloaded", "In progress"],
      platforms: ["Web", "iOS", "Android"],
      description: "Editorial summary with predictable reading metadata.",
    },
    {
      id: "reading-toolbar",
      name: "Reading toolbar",
      category: "Control",
      variants: ["Standard", "Focus"],
      states: ["Hidden", "Visible", "Text controls open"],
      platforms: ["iOS", "Android"],
      description: "Reading progress and typography controls.",
    },
    {
      id: "audio-player",
      name: "Audio player",
      category: "Media",
      variants: ["Full", "Mini"],
      states: ["Paused", "Playing", "Buffering", "Complete"],
      platforms: ["Web", "iOS", "Android"],
      description: "Shared playback behavior across full and compact surfaces.",
    },
    {
      id: "bottom-navigation",
      name: "Bottom navigation",
      category: "Navigation",
      variants: ["Three destination"],
      states: ["Today selected", "Listen selected", "Saved selected"],
      platforms: ["iOS", "Android"],
      description: "Top-level navigation with stable destinations.",
    },
  ],
  branches: [
    {
      name: "main",
      label: "Main",
      author: "Mina",
      commit: "81f4a2b",
      updatedAt: "Today, 09:42",
      changes: [],
    },
    {
      name: "feature/morrow-listen",
      label: "Listen iteration",
      author: "Theo",
      commit: "bc82091",
      updatedAt: "Today, 10:18",
      changes: [
        {
          path: "screens/listen/screen.json",
          kind: "modified",
          area: "Wireframe",
          summary: "Adds queue and playback-rate states.",
        },
        {
          path: "screens/listen/wireframe.png",
          kind: "modified",
          area: "Wireframe",
          summary: "Moves the article link below playback controls.",
        },
        {
          path: "documents/interaction-spec.md",
          kind: "conflict",
          area: "Document",
          summary: "Both branches changed mini-player dismissal behavior.",
          baseContent: `## Now Playing

- Closing the full player pauses playback.
- Returning to the story restores reading position.
- The mini player appears only from the Listen tab.`,
          compareContent: `## Now Playing

- Closing the full player keeps playback active.
- Returning to the story shows a persistent mini player.
- The mini player is available across Today, Story, and Saved.`,
          recommendation:
            "Keep playback active and show the mini player on Story and Saved. Leave Today unchanged in v0.1 to avoid adding persistent media state to the daily entry point.",
        },
        {
          path: "design/components.json",
          kind: "modified",
          area: "Design system",
          summary: "Adds the Buffering state to Audio player.",
        },
      ],
    },
  ],
  reviewStatus: {
    state: "updates-available",
    checkedAt: "2026-07-28T10:18:00+08:00",
    summary: "4 artifacts changed on the Listen iteration.",
    changedArtifacts: 4,
  },
};
