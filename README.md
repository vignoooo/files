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
