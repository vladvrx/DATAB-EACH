# DATAB-EACH recovered runtime map

This map is generated from the authoritative production ESM chunks. Line ranges refer to the
readable files in `vendor`. High-confidence engine and Vue component symbols receive
scope-safe names; all other compiler aliases remain untouched.

## Runtime boundaries

| Order | Recovered subsystem | WebGL lines | Root contracts |
| ---: | --- | ---: | --- |
| 1 | `time` | 7588-7656 | `time` |
| 2 | `renderer` | 7656-7723 | `renderer`, `threeRenderer` |
| 3 | `viewport` | 7723-7760 | `viewport` |
| 4 | `adaptive-quality` | 7760-7857 | `quality` |
| 5 | `framebuffer-pool` | 7857-7866 | `fbo` |
| 6 | `resources` | 7866-7938 | `resources` |
| 7 | `transitions` | 7938-8010 | `transitions` |
| 8 | `scene-manager` | 8010-8087 | `scenes` |
| 9 | `runtime-store` | 8087-8193 | `store` |
| 10 | `physics` | 8193-8199 | `initPhysics` |
| 11 | `particles` | 8199-8287 | `particles` |
| 12 | `audio` | 8287-8417 | `audio`, `smoothMute` |
| 13 | `input` | 8417-8513 | `clickIn`, `clickOut`, `input`, `pressed`, `useTouch` |

## Build inventory

- Engine: Three.js r150 (pinned as `three@0.150.1`)
- Runtime chunks: 3
- Canonical game assets: 930
- Canonical asset bytes: 20061548
- Source strategy: scope-safe AST recovery with generated source maps
- Fidelity rule: the recovered runtime remains active until each extracted subsystem passes the
  same browser journey against the authoritative build.
