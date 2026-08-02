# Files

## Claude Design Skillstack

This repository installs the [Claude Design Skillstack](https://github.com/freshtechbro/claudedesignskills)
plugin marketplace via [`.claude/settings.json`](.claude/settings.json). When a Claude Code
session starts in this repository, the marketplace is registered and all 22 design plugins
are enabled automatically — each providing a skill, slash commands, and specialized agents.

### Installed plugins

**Core 3D & animation:** threejs-webgl, gsap-scrolltrigger, react-three-fiber, motion-framer, babylonjs-engine

**Extended 3D & scroll:** aframe-webxr, lightweight-3d-effects, playcanvas-engine, pixijs-2d, locomotive-scroll, barba-js

**Animation & components:** react-spring-physics, animated-component-libraries, scroll-reveal-libraries, animejs, lottie-animations

**Authoring & motion tools:** blender-web-pipeline, spline-interactive, rive-interactive, substance-3d-texturing

**Meta:** web3d-integration-patterns, modern-web-design

To disable a plugin, set its entry to `false` in `.claude/settings.json` under `enabledPlugins`.

## Skills in `.claude/skills/`

Installed with the [`skills` CLI](https://github.com/vercel-labs/skills) (`npx skills add …`)
and pinned in [`skills-lock.json`](skills-lock.json). Run `npx skills update` to refresh them.

### Designer Skills — [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills)

A design process pipeline: `grill-me`, `design-brief`, `information-architecture`,
`design-tokens`, `brief-to-tasks`, `frontend-design`, `design-review`, and `design-flow`
(which orchestrates the rest).

### UI/UX engineering skills

| Skill | Source | Purpose |
| --- | --- | --- |
| `anthropic-frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | Aesthetic direction for new or reshaped UI |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Audits UI code against the Web Interface Guidelines |
| `vercel-react-best-practices` | vercel-labs/agent-skills | React/Next.js performance patterns |
| `vercel-composition-patterns` | vercel-labs/agent-skills | Compound components, render props, component APIs |
| `vercel-react-native-skills` | vercel-labs/agent-skills | React Native and Expo practices |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Searchable database of styles, palettes, fonts, UX rules |
| `design-system` | nextlevelbuilder/ui-ux-pro-max-skill | Three-layer token architecture and component specs |
| `ui-styling` | nextlevelbuilder/ui-ux-pro-max-skill | shadcn/ui, Tailwind, accessible component patterns |
| `bencium-innovative-ux-designer` | [bencium/bencium-claude-code-design-skill](https://github.com/bencium/bencium-claude-code-design-skill) | UX reference material, bold creative direction |
| `bencium-controlled-ux-designer` | bencium/bencium-claude-code-design-skill | Same material, consistency-first direction |
| `audit`, `diff`, `scan` | [AccessLint/skills](https://github.com/AccessLint/skills) | WCAG 2.2 auditing, violation diffing, codebase sweeps |

Two naming notes: Anthropic's skill is upstream named `frontend-design`, which collides with the
Designer Skills entry of the same name, so it is installed here as `anthropic-frontend-design`.
The AccessLint skills use the generic names `audit`, `diff`, and `scan` upstream — left as-is.

The AccessLint skills drive a headless Chrome session via the Chrome DevTools Protocol, so they
need a browser available at runtime.
