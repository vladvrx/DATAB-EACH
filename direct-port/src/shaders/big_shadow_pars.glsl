#define USE_BIG_SHADOWMAP
struct BigShadow{vec2 mapSize;float bias;float radius;};uniform BigShadow bigShadow;uniform float bigShadowFalloff;uniform float bigShadowDynamicChunks;uniform sampler2D bigShadowMap;varying vec4 vBigShadowDirectionalCoords;
