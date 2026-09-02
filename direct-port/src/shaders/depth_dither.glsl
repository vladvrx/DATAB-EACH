#ifndef HAS_WEBXR
vec2 dpUV=(gl_FragCoord.xy*pixelRatio)*0.15;dpUV.x+=step(1.,mod(dpUV.y,2.))*0.5;dpUV=fract(dpUV);float dpLimit=smoothstep(0.3,0.999,gl_FragCoord.w);float dpMask=smoothstep(dpLimit-0.2,dpLimit,length(dpUV-vec2(0.5)));if(dpMask<0.5){discard;}
#endif
