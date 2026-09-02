vec3 wColor=gl_FragColor.xyz-wet*0.09;vec3 underwaterColor=(wColor*waterTopColor)*UNDERWATER_MULT+0.4;
#ifdef IS_MAP_MODE
if(hasWater>0.9999){discard;}
#else
wColor=mix(wColor,underwaterColor,hasWater*0.8);wColor=mix(wColor,waterColor,hasWater*waterDepth);wColor=mix(wColor,vec3(1.),hasFoam*1.);
#endif
#if defined(IS_BIOME_TESTLAB)
float d=distance(vWorldPos.xz,vec2(0.));wColor=mix(wColor,gl_FragColor.xyz,step(40.,d));
#endif
gl_FragColor.xyz=vec3(wColor);
