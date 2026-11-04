import test from 'node:test';
import assert from 'node:assert/strict';
import { configureEnvironmentGestures } from '../src/ui/EnvironmentScale.js';

test('map follows native touch drag and pinch without custom camera jumps',()=>{
  const calls=[];
  const map={
    touchZoomRotate:{enable:()=>calls.push('touch-enable')},
    dragPan:{enable:()=>calls.push('pan-enable')},
    doubleClickZoom:{disable:()=>calls.push('double-disable')},
    scrollZoom:{setZoomRate:()=>{},setWheelZoomRate:()=>{}},
    keyboard:{disableRotation:()=>{}}
  };
  configureEnvironmentGestures(map);
  assert.deepEqual(calls,['touch-enable','pan-enable','double-disable']);
});
