/* =====================================================================
   STORY DATA — edge types, reels, NPCs + dialogue, endings.
   Edit this file to add reels / characters. Nothing here touches three.js.

   Dialogue functions get a context `c`:
     c.count        how many times you already talked to this NPC (0 = first time)
     c.has(reelId)  true if that reel is currently spliced into your cut
     c.talked(npc)  true if you've talked to that NPC id at least once
     c.n            number of reels in your cut right now
   ===================================================================== */

// ---------- edge types (what a reel starts / ends with) ----------
export const TYPES = {
  START:     { label: 'ACTION!',     icon: '🎬', color: '#e9e4d4' },
  DOOR:      { label: 'OPEN DOOR',   icon: '🚪', color: '#ff9f43' },
  STAIRS:    { label: 'STAIRCASE',   icon: '🪜', color: '#54a0ff' },
  BRIDGE:    { label: 'ROPE BRIDGE', icon: '🌉', color: '#1dd1a1' },
  TUNNEL:    { label: 'TUNNEL',      icon: '🕳️', color: '#a77bff' },
  ELEVATOR:  { label: 'ELEVATOR',    icon: '🛗', color: '#7fe3ff' },
  ROAD:      { label: 'OPEN ROAD',   icon: '🛣️', color: '#ffd1dc' },
  END_GOLD:  { label: 'HAPPY END',   icon: '🏁', color: '#feca57', finish: true },
  END_NOIR:  { label: 'TRAGIC END',  icon: '🌧️', color: '#ff5d5d', finish: true },
  END_TWIST: { label: 'PLOT TWIST',  icon: '🌀', color: '#ff6bd6', finish: true },
};
export const isFinish = t => !!TYPES[t].finish;

// ---------- endings ----------
export const ENDINGS = {
  END_GOLD: {
    title: 'THE HAPPY ENDING',
    text: c => 'The hero crosses the canyon and rides off into the sunrise. The audience cheers.'
      + (c.has('deleted') ? ' Vince, back in the film at last, waves from the crowd.' : '')
      + (c.has('sky') ? ' Von Strudel storms out of the cinema, furious.' : ''),
  },
  END_NOIR: {
    title: 'THE TRAGIC ENDING',
    text: c => 'Rain. Neon. Lou drives into the night and nobody gets the girl. Beautiful.'
      + (c.has('sewer') ? ' Edna the critic gives it five stars.' : '')
      + (c.talked('vince') ? ' Somewhere, a ghost nods in approval.' : ''),
  },
  END_TWIST: {
    title: 'THE PLOT TWIST',
    text: c => 'The Producer was the real villain all along. The audience gasps.'
      + (c.talked('vince') ? ' Vince, cut from every scene, was the only one who knew.' : ' Nobody saw it coming.')
      + (c.has('hall') ? ' (Gus the janitor saw it coming.)' : ''),
  },
};

// ---------- the reels ----------
// id         short name used by dialogue conditions
// props      [x, z, w, d, h, color, shape?]  — local to the reel. Keep |z|<3.4 free for |x|>4.5 (the walkways).
// npc        optional character you can talk to with E. Keep |x| <= 4.
// home       [x, _, z, rotY] where the reel lies loose at the start
export const REELS = [
  { id: 'open', name: 'OPENING SHOT', start: 'START', end: 'DOOR',
    floor: '#3c4a66', alt: '#34415a', pattern: 'checker', home: [0, 0, 0],
    props: [[-7,-4.5,2.2,2.2,1.6,0x8a6a43],[-3.5,4.8,3,1.6,1.2,0x7a5b3a],[0.5,-4,1.6,1.6,2.4,0x555a66,'cyl'],[3,4.5,2,2,1,0x8a6a43],[-9.5,4.5,1.5,1.5,1,0x6d4f2f]],
    npc: { id: 'penny', name: 'Penny, Script Supervisor', x: -2.6, z: -1.6, body: 0x4aa8a0, hat: 'none',
      lines: c => c.count === 0 ? [
        "Oh, you're awake! I'm Penny, the script supervisor.",
        "The film got chopped into reels. Every reel must END exactly how the next one STARTS. An open door has to meet an open door. Continuity is everything.",
        "Scroll out to see the loose reels, then grab one and drag it onto the glowing gate.",
        "Not every reel belongs in the final cut, Director. And the cut you make decides the ending.",
      ] : [
        "Match the badges: same icon, same colour.",
        c.n > 2 ? "Nice splicing. But who's waiting at the end is up to you." : "Zoom out. The reels won't come to you.",
        "You can pull the last reel back off if you change your mind. Just don't be standing on it!",
      ] } },

  { id: 'hall', name: 'HALLWAY CHASE', start: 'DOOR', end: 'STAIRS',
    floor: '#5d2a35', alt: '#4f222c', pattern: 'carpet', home: [24, 0, -34, -0.12],
    props: [[-6,-5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],[0,-5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],[6,-5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],
            [-6,5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],[0,5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],[6,5.2,1.6,1.6,3.6,0xd8c9a8,'cyl'],
            [1.5,-1.2,3,1.4,1,0x5a3320],[-2.5,1.8,1.2,1.2,1.2,0x7a2a2a]],
    npc: { id: 'gus', name: 'Gus, Janitor', x: -3.6, z: -2.4, body: 0x6b7f3a, hat: 'cap', hatColor: 0x2d3a1a,
      lines: c => c.count === 0 ? [
        "Mind the wet floor! Not that it matters. I've mopped this hallway for forty takes.",
        "These stairs go UP to the rooftop. Down is the boiler room, if you hate daylight.",
        c.talked('vince') ? "You met Vince? Poor guy. Cut from every scene." : "Folks say there's a ghost in the deleted scenes. I don't go looking.",
      ] : [
        "Watch your step.",
        c.has('roof') ? "Rooftop's nice this time of year. Bit windy." : "Stairs are right ahead. Up or down depends on what you splice next.",
      ] } },

  { id: 'roof', name: 'ROOFTOP', start: 'STAIRS', end: 'BRIDGE',
    floor: '#46505c', alt: '#3d4651', pattern: 'checker', home: [88, 0, 37, 0.1],
    props: [[-6,4.5,3,3,1.4,0x777f8a],[2,-4.5,2.2,2.2,2.6,0x8a7f77],[6,5.4,3.2,3.2,3,0x6b7c8f,'cyl'],[-2,-5.5,0.5,0.5,4,0x333333,'cyl']],
    npc: { id: 'dani', name: 'Dani, Stunt Double', x: -2, z: 1.2, body: 0xd9a21b, hat: 'none',
      lines: c => c.count === 0 ? [
        "Dani, stunt double. I jump off things so other people don't have to.",
        "See that rope bridge at the end? It crosses to a canyon they call The Chasm. The big finale was shot there.",
        c.has('hall') ? "You came up from the hallway? Is Gus still mopping?" : "How did you even get up here? Never mind.",
      ] : [
        "Don't look down.",
        "If a rope bridge shows up, I'd take it. Happy endings are underrated.",
      ] } },

  { id: 'chasm', name: 'THE CHASM', start: 'BRIDGE', end: 'END_GOLD',
    floor: '#6a5836', alt: '#5d4c2d', pattern: 'planks', home: [120, 0, -37, 0.1],
    props: [[-6,-4.8,2.6,2.6,1.6,0x666a70],[-1.5,4.6,2.2,2.2,1.1,0x70757c],[4.5,-4.6,2.4,2.4,1.9,0x5c6066],[7,5.2,1.8,1.8,1.2,0x70757c]],
    npc: { id: 'hollis', name: 'Hollis, Old Projectionist', x: 1.5, z: 1.2, body: 0x8d7a66, hat: 'tophat', hatColor: 0x222222,
      lines: c => c.count === 0 ? [
        "Hollis. I've run this projector since the very first frame.",
        "A golden arch at the end of this reel. The classic happy ending. Audiences adore it.",
        c.talked('vince') ? "You spoke to Vince, didn't you? Then you know a happy ending isn't the only truth. Try a different cut next time."
                          : "There are other endings, if you splice differently. The cut is yours, Director.",
      ] : [ "Go on. The ending is right there.", "Or run back and try another cut. I'll keep the projector warm." ] } },

  { id: 'deleted', name: 'DELETED SCENE', start: 'DOOR', end: 'STAIRS',
    floor: '#4a3566', alt: '#412e5a', pattern: 'checker', home: [-8, 0, 35, -0.1],
    props: [[-5,-4.5,2.2,2.2,2.2,0xc04dd0],[0,4.8,2,2,3,0x9b3fb0],[5,-5,2.2,2.2,1.2,0xc04dd0],[-8,4.8,1.6,1.6,1.6,0xb050c0]],
    npc: { id: 'vince', name: 'Vince, Ghost of the Hero', x: -1, z: -1, body: 0xbfe6ff, hat: 'none', ghost: true,
      lines: c => c.count === 0 ? [
        "Ooooo... don't be scared. I'm Vince. I was the hero. Then I was cut.",
        "Every deleted scene ends up here, forgotten.",
        "But YOU are the Director. If you put this reel back in the film, I get to exist again.",
        "Whatever ending you pick... please remember me.",
      ] : [
        c.has('deleted') ? "I'm in the film again! Thank you, Director!" : "Please. Just a few minutes of screen time.",
        "The Producer says everything on the cutting-room floor was bad. Don't believe him.",
      ] } },

  { id: 'lobby', name: 'HOTEL LOBBY', start: 'DOOR', end: 'ELEVATOR',
    floor: '#8d8a80', alt: '#7b786f', pattern: 'checker', home: [56, 0, 34, -0.15],
    props: [[-1,-4.8,5,1.6,1.3,0x5a3a22],[-8,4.8,1.2,1.2,1.6,0x2f6b3a,'cyl'],[4.5,5,3.4,1.5,0.9,0x7a2a3a],[8.5,-5,1.2,1.2,1.6,0x2f6b3a,'cyl']],
    npc: { id: 'mona', name: 'Mona, Receptionist', x: -1.5, z: -2.6, body: 0xb04a6e, hat: 'none',
      lines: c => c.count === 0 ? [
        "Welcome to the Grand Cinema Hotel. The elevator is straight ahead.",
        "Up top is the Penthouse. The Producer lives there. Very important man, very rude.",
        "The elevator also goes to the old skybridge. Why anyone would want that, don't ask me.",
      ] : [
        "Checking out already?",
        c.has('pent') ? "You went up to see the Producer? Brave." : "The elevator has two buttons. Choose wisely.",
      ] } },

  { id: 'pent', name: 'PENTHOUSE', start: 'ELEVATOR', end: 'END_TWIST',
    floor: '#2c2438', alt: '#241d30', pattern: 'carpet', home: [88, 0, -34, -0.08],
    props: [[2,-4.6,5,2,1.2,0x3a2a1a],[-6,4.8,1.2,1.2,2.2,0xffd34d,'cyl'],[6,5.2,1.6,1.6,1.2,0x553355],[-8,-5,1.6,1.6,1.2,0x553355]],
    npc: { id: 'producer', name: 'Mr. Gold, the Producer', x: -1.5, z: 0.8, body: 0x1d1d26, hat: 'tophat', hatColor: 0xffd34d,
      lines: c => c.count === 0 ? [
        "Ah, the Director. Finally.",
        "The studio wants a twist ending. Nobody remembers happy endings, you know.",
        c.talked('vince') ? "And don't listen to ghosts. Everything on the cutting-room floor was rubbish. Including him." : "Walk through that pink gate and we'll all be rich.",
      ] : [
        "Do we have a deal?",
        c.has('deleted') ? "...Why is Vince in my movie?" : "The pink gate. After you.",
      ] } },

  { id: 'boiler', name: 'BOILER ROOM', start: 'STAIRS', end: 'TUNNEL',
    floor: '#3a3330', alt: '#322c29', pattern: 'checker', home: [24, 0, 37, 0.12],
    props: [[-6,-4.8,3.2,3.2,3.6,0x7a4b3a,'cyl'],[-1,5.2,2.8,2.8,3.2,0x8a5a44,'cyl'],[6,-5,3,3,3.4,0x7a4b3a,'cyl'],[3.5,5.4,4,0.8,0.8,0x555555]],
    npc: { id: 'rusty', name: 'Rusty, Stoker', x: 0, z: -1.8, body: 0xa04a2a, hat: 'hardhat', hatColor: 0xffc400,
      lines: c => c.count === 0 ? [
        "Boiler room. Hot, loud, and nobody asks questions.",
        "That tunnel leads to the sewers. The sewers lead out of town.",
        c.has('hall') ? "Gus sent you down? That old mop owes me money." : "If you need a getaway, find Lou. He drives with the lights off.",
      ] : [ "Mind the pipes.", "Rain's coming. Good night for a drive." ] } },

  { id: 'sewer', name: 'SEWER RUN', start: 'TUNNEL', end: 'ROAD',
    floor: '#2f4a46', alt: '#294140', pattern: 'checker', home: [-8, 0, -36, 0.1],
    props: [[-6,5,2.2,2.2,1.4,0x6a5a3a],[2,-5,1.6,1.6,1.6,0x6a6a72,'cyl'],[7,5,2,2,1.2,0x6a5a3a],[-9,-4.6,1.6,1.6,1.6,0x6a6a72,'cyl']],
    npc: { id: 'edna', name: 'Edna, Film Critic', x: -2, z: 1.6, body: 0x7a4a8a, hat: 'beret', hatColor: 0x111111,
      lines: c => c.count === 0 ? [
        "I'm a film critic. I live in the sewers because nobody wants my reviews.",
        "So far this film is two stars. Predictable.",
        "Make it TRAGIC and I might upgrade you to five.",
      ] : [
        c.n > 4 ? "Oh, a long cut. Ambitious." : "Hurry up. I have a column to file.",
        "The road is ahead. Lou is waiting.",
      ] } },

  { id: 'road', name: 'GETAWAY ROAD', start: 'ROAD', end: 'END_NOIR',
    floor: '#2a2d33', alt: '#2a2d33', pattern: 'road', home: [120, 0, 34, -0.1],
    props: [[-3.5,-5.3,4.2,2,1.3,0xa02030],[4.5,5.3,0.4,0.4,4.2,0x444444,'cyl'],[-6,5.3,0.4,0.4,4.2,0x444444,'cyl']],
    npc: { id: 'lou', name: 'Lou, Getaway Driver', x: 1, z: -3.8, body: 0x333a4a, hat: 'cap', hatColor: 0x111111,
      lines: c => c.count === 0 ? [
        "Engine's running. I only do tragic endings, Director. Rain, neon, regret.",
        "Walk through the red gate. I won't look back.",
        c.has('sewer') ? "You came through the sewer? Smells like a Tuesday." : "",
      ].filter(Boolean) : [ "Whenever you're ready.", "Don't make me wait. The rain won't." ] } },

  { id: 'sky', name: 'SKYBRIDGE DUEL', start: 'ELEVATOR', end: 'BRIDGE',
    floor: '#38424f', alt: '#2f3945', pattern: 'planks', home: [56, 0, -37, 0.15],
    props: [[-6,-5,2,2,1.4,0x777f8a],[-2,5.2,2.2,2.2,1.2,0x777f8a],[5,-5,2.4,2.4,1.8,0x6b7c8f],[7,5.2,1.8,1.8,1.2,0x777f8a]],
    npc: { id: 'strudel', name: 'Von Strudel, Rival Director', x: -0.5, z: 1.2, body: 0x7a1d3a, hat: 'beret', hatColor: 0xcc2255,
      lines: c => c.count === 0 ? [
        "So YOU are the Director. I'm Von Strudel. Your rival.",
        "You don't deserve the final cut. My version has explosions.",
        "Cross the bridge. I'll be waiting at the canyon. Hmph.",
      ] : [
        c.has('chasm') ? "You won't beat me to the finale!" : "Go on, splice the next reel. If you can find it.",
        "My film will win every award.",
      ] } },
];
