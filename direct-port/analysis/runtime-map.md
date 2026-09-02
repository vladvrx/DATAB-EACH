# DATAB-EACH recovered runtime map

This map is generated from the authoritative production ESM chunks. Line ranges refer to the
readable files in `direct-port/assets`. High-confidence engine and Vue component symbols receive
scope-safe names; all other compiler aliases remain untouched.

## Runtime boundaries

| Order | Recovered subsystem | WebGL lines | Root contracts |
| ---: | --- | ---: | --- |
| 1 | `time` | 7610-7678 | `time` |
| 2 | `renderer` | 7678-7745 | `renderer`, `threeRenderer` |
| 3 | `viewport` | 7745-7782 | `viewport` |
| 4 | `adaptive-quality` | 7782-7879 | `quality` |
| 5 | `framebuffer-pool` | 7879-7888 | `fbo` |
| 6 | `resources` | 7888-7960 | `resources` |
| 7 | `transitions` | 7960-8032 | `transitions` |
| 8 | `scene-manager` | 8032-8109 | `scenes` |
| 9 | `runtime-store` | 8109-8215 | `store` |
| 10 | `physics` | 8215-8221 | `initPhysics` |
| 11 | `particles` | 8221-8309 | `particles` |
| 12 | `audio` | 8309-8439 | `audio`, `smoothMute` |
| 13 | `input` | 8439-8535 | `clickIn`, `clickOut`, `input`, `pressed`, `useTouch` |

## Build inventory

- Engine: Three.js r150 (pinned as `three@0.150.1`)
- Runtime chunks: 3
- Canonical game assets: 930
- Canonical asset bytes: 20061548
- Source strategy: scope-safe AST recovery with generated source maps
- Fidelity rule: the recovered runtime remains active until each extracted subsystem passes the
  same browser journey against the authoritative build.
