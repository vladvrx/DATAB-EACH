#ifndef FOG_FAR_MULT
#define FOG_FAR_MULT 1.
#endif
#ifdef USE_FOG
#ifndef USE_MAP_MODE
float _fogNear=fogNear;float fogFactor=smoothstep(_fogNear*1.1,fogFar*FOG_FAR_MULT,vFogDepth);float fogFactor2=smoothstep(_fogNear*0.7,fogFar*0.9*FOG_FAR_MULT,vFogDepth);fogFactor2*=1.-fogFactor;const vec3 fogColor=FOG_FAR;const vec3 fogColor2=FOG_NEAR;gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor2,clamp(fogFactor2*1.1,0.,1.));gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(fogFactor*0.7,0.,1.));
#endif
#endif
