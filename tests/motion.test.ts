import { expect, it } from 'vitest';
import { defaultState, setDimension, setViewMode, resetCamera, validState } from '../src/ui/state';
import { advanceCamera, lookCodes, playerCodes, speeds } from '../src/ui/inputMapping';
import { advancePlayerMotion, correctPlayerContact, feetHeight, setMotionMode, jumpSpeed, playerHalfExtent } from '../src/ui/playerMotion';
import { roomHalfExtent } from '../src/ui/roomBoundary';
import { playerViewCamera } from '../src/projection/playerCamera';
import { roomColors, roomGrid } from '../src/geometry/roomGrid';
import { projectPlayerWorld } from '../src/projection/playerCamera';

it.each([2,3,4] as const)('applies normal/inverted mouse Y in both %iD views', dimension => {
  for (const view of ['fps','tps'] as const) {
    const state = setViewMode(setDimension(defaultState(), dimension), view);
    const normal = advanceCamera(state, new Set(), .1, [0,30], 'camera4d');
    const inverted = advanceCamera({...state, invertY:true}, new Set(), .1, [0,30], 'camera4d');
    const axis = dimension === 2 ? 'XY' : dimension === 3 ? 'YZ' : 'YW';
    const look = view === 'fps' ? normal.angles : normal.tpsLookAngles;
    const inverseLook = view === 'fps' ? inverted.angles : inverted.tpsLookAngles;
    expect(look[axis]).toBeCloseTo(-.06);
    expect(inverseLook[axis]).toBeCloseTo(.06);
    if (dimension >= 3) expect(playerViewCamera(normal).rotation[dimension-1][1]).toBeLessThan(0);
    if (view === 'tps') expect(normal.angles).toEqual(state.angles);
    expect(advanceCamera(state,new Set(),.1,[0,30],'observer3d')).toBe(state);
  }
});
it('uses time-based arrow ZW only for 4D Player and preserves Z movement', () => {
  for (const fps of [30,60,144]) {
    let state = defaultState();
    for (let i=0;i<fps;i++) state = advanceCamera(state,new Set([lookCodes.positiveZW]),1/fps,[0,0],'camera4d');
    expect(state.angles.ZW).toBeCloseTo(speeds.zw,10);
  }
  const state = defaultState();
  expect(advanceCamera(state,new Set([playerCodes.positiveW]),.1,[0,0],'camera4d').angles.ZW).toBe(0);
  for (const dimension of [2,3] as const) expect(advanceCamera(setDimension(state,dimension),new Set([lookCodes.positiveZW]),.1,[0,0],'camera4d').angles.ZW).toBe(0);
  expect(advanceCamera(state,new Set([lookCodes.positiveZW]),.1,[0,0],'observer3d')).toBe(state);
});
it.each([2,3,4] as const)('falls and lands using Player feet in %iD, independently of view/input owner', dimension => {
  for (const view of ['fps','tps'] as const) {
    let state = setMotionMode(setViewMode(setDimension(defaultState(),dimension),view),'gravity');
    for (let i=0;i<180;i++) state=advanceCamera(state,new Set(),1/60,[0,0],'observer3d');
    expect(feetHeight(state)).toBeCloseTo(-roomHalfExtent);
    expect(state.grounded).toBe(true); expect(state.verticalVelocity).toBe(0);
  }
});
it('jumps only on a grounded new press, holds through landing, then permits another jump', () => {
  let state = correctPlayerContact({...defaultState(),motionMode:'gravity',position:[0,-10,0,0]});
  state = advancePlayerMotion(state,.01,true);
  expect(state.verticalVelocity).toBeGreaterThan(0); expect(state.verticalVelocity).toBeLessThan(jumpSpeed);
  const airborne = advancePlayerMotion(advancePlayerMotion(state,.01,false),.01,true);
  expect(airborne.verticalVelocity).toBeLessThan(state.verticalVelocity);
  for (let i=0;i<180;i++) state=advancePlayerMotion(state,1/60,true);
  expect(state.grounded).toBe(true); expect(state.verticalVelocity).toBe(0);
  state=advancePlayerMotion(advancePlayerMotion(state,.01,false),.01,true);
  expect(state.verticalVelocity).toBeGreaterThan(0);
});
it('stops upward velocity at the ceiling and slides along active walls', () => {
  const ceiling=advancePlayerMotion({...defaultState(),motionMode:'gravity',position:[0,4.59,0,0],verticalVelocity:5},.01,false);
  expect(ceiling.position[1]).toBeLessThanOrEqual(roomHalfExtent-playerHalfExtent[1]);
  expect(ceiling.verticalVelocity).toBeLessThanOrEqual(0);
  const state=correctPlayerContact({...defaultState(),motionMode:'gravity',position:[10,-10,0,0]});
  const next=advanceCamera(state,new Set([playerCodes.right,playerCodes.forward]),.1,[0,0],'camera4d');
  expect(next.position[0]).toBe(4.6); expect(next.position[3]).toBeGreaterThan(0);
  expect(next.position[1]).toBe(-4.6);
});
it('retains inactive coordinates and safely corrects newly activated boundaries', () => {
  const state=correctPlayerContact({...setDimension(defaultState(),2),motionMode:'gravity',position:[0,0,8,-9]});
  expect(state.position.slice(2)).toEqual([8,-9]);
  const three=setDimension(state,3); expect(three.position[2]).toBe(4.6); expect(three.position[3]).toBe(-9);
  const four=setDimension(three,4); expect(four.position[3]).toBe(-4.6);
  expect(setViewMode(four,'tps').verticalVelocity).toBe(four.verticalVelocity);
  expect(resetCamera(four).motionMode).toBe('gravity');
});
it('switches modes without stale velocity or a held-Space jump and restores flight ascent', () => {
  const gravity=setMotionMode({...defaultState(),position:[0,-4.6,0,0]},'gravity');
  expect(advancePlayerMotion(gravity,.01,true).grounded).toBe(true);
  const flight=setMotionMode({...gravity,verticalVelocity:4},'flight');
  expect(flight.verticalVelocity).toBe(0); expect(flight.grounded).toBe(false);
  expect(advanceCamera(flight,new Set(['Space']),.1,[0,0],'camera4d').position[1]).toBeCloseTo(-4.4);
  expect(advanceCamera(defaultState(),new Set(['ShiftLeft']),.1,[0,0],'camera4d').position[1]).toBeCloseTo(-.2);
});
it('integrates gravity consistently across frame rates and rejects nonfinite dt', () => {
  const ys=[30,60,144].map(fps => {
    let state=setMotionMode(defaultState(),'gravity');
    for(let i=0;i<fps/2;i++) state=advancePlayerMotion(state,1/fps,false);
    expect(validState(state)).toBe(true); return state.position[1];
  });
  ys.forEach(y=>expect(y).toBeCloseTo(-1.125,10));
  const state=setMotionMode(defaultState(),'gravity');
  expect(advancePlayerMotion(state,NaN,false)).toBe(state);
});
it.each([2,3,4] as const)('builds sparse colored intrinsic %iD boundary lines using the existing projection', dimension => {
  const grids=roomGrid(dimension);
  expect(roomColors).toEqual([0x82B69C,0x5A9BD5,0xE5BD6B,0xD59B84,0xB49ADA]);
  grids.forEach((g,index)=> {
    const axis=index===0?0:index<=2?1:index-1;
    if(axis>=dimension) expect(g.edges).toHaveLength(0);
    else {
      expect(g.edges.length).toBeGreaterThan(0);
      g.vertices.forEach(p=> { expect(Math.abs(p[axis])).toBe(roomHalfExtent); expect(p.slice(dimension).every(v=>v===0)).toBe(true); });
    }
    const projected=projectPlayerWorld(g,setDimension(defaultState(),dimension));
    expect(projected.edges.every(e=>[...e.start,...e.end].every(Number.isFinite))).toBe(true);
  });
  expect(grids.flatMap(g=>g.edges).length).toBeLessThan(250);
});
