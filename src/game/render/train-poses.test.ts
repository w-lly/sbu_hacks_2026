import { describe,it,expect } from 'vitest';
import type { FreightLine,FreightTrain } from '../factory';
import { trainPoses } from './train-poses';
import { toIso } from './iso';
const train:FreightTrain={id:0,seg:0,t:.75,dir:1,cargo:[],dwell:0,started:true};
const stations=[{pos:[0,0] as [number,number]},{pos:[100,100] as [number,number]},{pos:[200,100] as [number,number]}];
const edge={a:0,b:1,path:[[0,0],[100,0],[100,100]] as [number,number][],survey:{length:200,grade:0,waterRuns:[],cost:0,mix:{land:200,water:0,woods:0,wetland:0,park:0}},crossings:[],cost:0};
const line:FreightLine={id:0,name:'Test',stops:[0,1],segments:[edge],trains:[train],carriages:2,type:'rail'};
describe('rolling stock presentation',()=>{
 it('places carriages behind the head on each leg of a bend',()=>{const poses=trainPoses(line,train,stations,40);expect(poses.map(p=>[p.x,p.y])).toEqual([[100,50],[100,10],[70,0]]);});
 it('faces the direction of travel when returning',()=>{const poses=trainPoses({...line,carriages:1},{...train,dir:-1,t:.5},stations,40);expect(poses.map(p=>[p.x,p.y])).toEqual([[100,0],[100,40]]);const p=poses[1];if(!p)throw Error('missing car');const [dx,dy]=toIso([0,-40]);expect(p.ang).toBeCloseTo(Math.atan2(dy,dx));});
 it('keeps couplings joined through turns',()=>{const poses=trainPoses(line,train,stations,40);expect(poses[0]?.rear).toEqual(poses[1]?.front);expect(poses[1]?.rear).toEqual(poses[2]?.front);});
 it('trails across stored segment boundaries',()=>{const extension={...edge,a:1,b:2,path:[[100,100],[200,100]] as [number,number][]};const poses=trainPoses({...line,stops:[0,1,2],segments:[edge,extension]},{...train,seg:1,t:.2},stations,40);expect(poses.map(p=>[p.x,p.y])).toEqual([[120,100],[100,80],[100,40]]);});
 it('keeps the consist on the rails at both terminals',()=>{for(const dir of [1,-1] as const){const poses=trainPoses(line,{...train,t:dir===1?0:1,dir},stations,40);expect(poses.map(p=>[p.x,p.y])).toEqual(dir===1?[[80,0],[40,0],[0,0]]:[[100,20],[100,60],[100,100]]);}});
 it('does not alter simulation or drift while waiting',()=>{const waiting={...train,dwell:2},before=JSON.stringify({line,waiting,stations});const poses=trainPoses(line,waiting,stations);expect(trainPoses(line,waiting,stations)).toEqual(poses);expect(JSON.stringify({line,waiting,stations})).toBe(before);});
 it('turns gradually across a corner instead of snapping by ninety degrees',()=>{const angles=[.45,.475,.5,.525,.55].map(t=>trainPoses({...line,carriages:0},{...train,t},stations)[0]?.ang??0);for(let i=1;i<angles.length;i++)expect(Math.abs((angles[i]??0)-(angles[i-1]??0))).toBeLessThan(.6);});
});