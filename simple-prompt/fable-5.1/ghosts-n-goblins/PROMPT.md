# One-Shot Prompt: Ghosts 'n Goblins — The Cursed PC Gaming Museum

```text
We are going to build a retro arcade action-platformer inspired by Ghosts 'n Goblins (Makaimura) and Ghouls 'n Ghosts inside the `ghosts-n-goblins/` directory as a single one-shot prompt. You are a hardcore retro arcade historian, pixel-art demoscene coder, and wildly inventive game designer. Make all design and technical decisions yourself and build the complete, playable game in one shot using pure, dependency-free Vanilla JavaScript, HTML, and CSS at a locked 60 FPS.

Use these core specifications:

1. GRAPHICS & ENGINE (CPS-1 / EGA-VGA 320x200 Software Framebuffer):
- Render into a 320x200 pixel-perfect software framebuffer with 3-layer parallax scrolling, dynamic lightning flashes, particle physics (shattering bones, armor plates, embers, blood/ectoplasm splashes), and a toggleable CRT scanline monitor bezel.
- Animate full multi-frame pixel-art sprites for Sir Arthur (run, crouch, climb ladders, throw, armor-shatter explosion, embarrassed strawberry boxer-shorts run, and Golden Armor cape), plus undead enemies (rising zombies, bone-throwing skeletons, swooping Red Arremer gargoyles, haunted armor, and giant multi-part bosses).

2. THE OUT-OF-THE-BOX TWISTS (TACTICAL ARMOR, MONSTER POSSESSION & BOXER-SHORTS PHASE SHIFT):
- Taking a hit shatters your armor, leaving you in classic strawberry-print boxer shorts—OR the player can intentionally press [E] / Right-Click to EJECT their armor early!
- Ejected armor acts as a heavy decoy anvil that crushes enemies below, weighs down pressure plates, and can be bounced off like a springboard.
- In STEEL ARMOR MODE: You are heavy, immune to wind, can smash cracked floors on landing, and fire empowered weapons.
- In BOXER SHORTS MODE:
  * You move 35% faster, can double-jump, and gain "Spectral Vision" that reveals invisible ghost platforms and secret treasure chests.
  * POSSESSION CURSE: Pressing [E] / Right-Click while in your boxer shorts lets your exposed soul leap into and POSSESS the nearest non-boss monster on screen for 8 seconds (fly over spike pits as a Red Arremer Gargoyle, burrow and spit acid as a Zombie, or hurl rapid bones as a Skeleton) until you crack open a chest to reclaim your Knight's Armor!
- Finding a hidden Magician Chest upgrades you to GOLDEN ARMOR, allowing you to charge up screen-clearing magic spells.

3. WEAPON ARSENAL (5 Swap-On-Pickup Weapons):
- Javelin / Lance (fast, straight trajectory, high damage)
- Throwing Dagger (rapid-fire, low cooldown)
- Holy Water Torch (lobbed arc that ignites into creeping blue ground flames)
- Battle Axe (wide upward arc that pierces through multiple enemies and shields)
- Boomerang Cross / Shield (travels out and returns, destroys enemy projectiles)

4. LEVELS & REACTIVE ENEMY AI ("THE CURSED PC GAMING MUSEUM" — 6 STAGES + BOSS):
- Include 6 distinct scrolling stages with a classic arcade parchment World Map intro screen, where each stage is a haunted graveyard parody of a legendary late-80s / early-90s PC game:
  * Stage 1: LeChuck's Ghost Ship & Mêlée Graveyard (Monkey Island — rocking pirate deck, voodoo skulls & zombie buccaneers)
  * Stage 2: The Haunted Moat of Daventry (King's Quest — lethal cursed water, collapsing drawbridges & gothic gargoyles)
  * Stage 3: The Jaffar Spike Catacombs (Prince of Persia — chomping iron slicer gates, pressure-plate potions & skeleton swordsmen)
  * Stage 4: The Lemmings Crusher Foundry (Lemmings — industrial piston crushers, conveyor belts & exploding blockers)
  * Stage 5: Phobos E1M1 Necropolis (DOOM — toxic nukage slime pits, cyber-imps & an intelligent Red Arremer Gargoyle mini-boss AI that dodges horizontal shots, hovers, and swoop-dives)
  * Stage 6: Throne of Astaroth-LeChuck-9000 (Final Boss — a massive multi-phase demon overlord guarding the Cursed Floppy Disk)
- Include a Stage Warp selector so any of the 6 stages can be played immediately.

5. AUDIO (OPL3 / Arcade YM2151 FM + PSG Synthesizer):
- Build a procedural Web Audio API FM synthesizer playing gothic baroque harpsichord, spooky pipe organ, driving arcade FM bass, and crisp percussion.
- Include distinct musical themes across the stages that dynamically speed up and shift octave when the player is reduced to their boxer shorts, plus authentic arcade sound effects for armor shattering, monster possession, weapon throws, chest spawns, and the classic stage-intro map jingle.

6. CONTROLS (Keyboard + Mouse):
- Keyboard: A/D or Left/Right to move, W/S or Up/Down to aim up/crouch/climb ladders, Space/Z to Jump, J/X or Left-Click to Attack, E/C or Right-Click to Eject Armor / Possess Monster / Cast Golden Magic.
```
