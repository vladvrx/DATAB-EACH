vec2 cT=vec2(-0.0012,0.)*time;
#ifdef IS_MOBILE
float cB=texture2D(noise,vWorldPos.xz*0.0012+cT).r;float clouds=smoothstep(0.45,0.34,cB);
#ifndef IS_MAP_MODE
diffuseColor.rgb+=diffuseColor.rgb*clouds*-0.10*CLOUDS_COLOR;
#endif
#else
float cA=texture2D(noise,vWorldPos.xz*0.009+cT).r;float cB=texture2D(noise,vWorldPos.xz*0.001+cT+cA*0.005).r;float clouds=smoothstep(0.45,0.38,cB);
#ifndef IS_MAP_MODE
diffuseColor.rgb+=diffuseColor.rgb*clouds*-0.11*CLOUDS_COLOR;
#endif
#endif
