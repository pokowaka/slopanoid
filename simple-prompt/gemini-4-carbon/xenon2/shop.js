(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});
  const { WEAPONS, SPRITES, PALETTE, RAMP } = XENON;

  const CRISPIN_QUIPS = {
    welcome: [
      "Welcome to Crispin's Emporium! Best chrome this side of the Cambrian, mate!",
      "Mind the space-dust on the counter! 50% trade-in on lightly scorched parts!",
      "Electro-Dub on the decks and plasma in the racks — what'll it be, pilot?",
      "Trapped in a cul-de-sac? Reverse-thrust out and bolt some Bounce-Orbs on!"
    ],
    buy: [
      "Bolted straight onto your fuselage! Mind the recoil, governor!",
      "A connoisseur's choice! Freshly polished chrome, zero Xenite slime!",
      "Pleasure haggling with ya! That hardpoint's gonna sing!"
    ],
    sell: [
      "50% cash back in your pocket — hardly a laser dent on it!",
      "I'll buff out the carbon scoring and flip it in the Babbage sector!",
      "Fair trade, mate! Credits transferred!"
    ],
    synergy: [
      "BLIMEY! GOLDEN WEAPON SYNERGY UNLOCKED! Look at that harmonic resonance!",
      "WHOA! You've wired a legendary Synergy Combo — the Xenites are toast!"
    ],
    nashwan: [
      "SUPER NASHWAN POWER?! Stand back!! 20 seconds of FULL ARSENAL OVERDRIVE!!",
      "BY THE BITMAP GODS — SUPER NASHWAN ARMED! Everything fires at once!!"
    ],
    broke: [
      "Short on Credits, mate! Pop more Cash Bubbles or sell a hardpoint for 50%!",
      "No tick in this timeline, pilot! Trade in an old gun or blast more swarms!"
    ]
  };

  class CrispinShopController {
    constructor(game) {
      this.game = game;
      this.isOpen = false;
      this.selectedSlot = 'all'; // 'all' | 'nose' | 'leftWing' | 'rightWing' | 'rearTail' | 'drones' | 'hull' | 'specials'
      this.speechText = CRISPIN_QUIPS.welcome[0];
      this.speechTimer = 0;
      this.blipCounter = 0;
      this.previewTick = 0;

      this.modalEl = null;
      this.portraitCanvas = null;
      this.portraitCtx = null;
      this.paperDollCanvas = null;
      this.paperDollFb = null;
    }

    bindDOM() {
      this.modalEl = document.getElementById('shop-modal');
      this.portraitCanvas = document.getElementById('crispin-canvas');
      if (this.portraitCanvas) {
        this.portraitCtx = this.portraitCanvas.getContext('2d');
      }
      this.paperDollCanvas = document.getElementById('paperdoll-canvas');
      if (this.paperDollCanvas) {
        this.paperDollFb = new XENON.Framebuffer(this.paperDollCanvas);
      }

      const closeBtn = document.getElementById('shop-undock-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      document.querySelectorAll('[data-shop-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedSlot = btn.getAttribute('data-shop-tab');
          this.renderInventory();
        });
      });
    }

    say(category, customText = null) {
      if (customText) {
        this.speechText = customText;
      } else {
        const list = CRISPIN_QUIPS[category] || CRISPIN_QUIPS.welcome;
        this.speechText = list[Math.floor(Math.random() * list.length)];
      }
      this.speechTimer = 72; // ~1.2 seconds of jaw animation + blips
      const el = document.getElementById('crispin-dialogue');
      if (el) el.textContent = '"' + this.speechText + '"';
    }

    open(reason = 'manual') {
      if (this.isOpen) return;
      XENON.audio.init();
      this.isOpen = true;
      XENON.audio.setShopMode(true);
      if (this.modalEl) this.modalEl.classList.remove('hidden');

      if (reason === 'midstage') {
        this.say('welcome', "Mid-Epoch Warp Dock! Patch your hull & bolt on new chrome before the Boss!");
      } else if (reason === 'stageclear') {
        this.say('welcome', "Epoch Guardian obliterated! Spend those lovely Cash Bubbles before Time-Jump!");
      } else {
        this.say('welcome');
      }
      this.renderInventory();
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      XENON.audio.setShopMode(false);
      if (this.modalEl) this.modalEl.classList.add('hidden');
      if (this.game && this.game.onShopClosed) {
        this.game.onShopClosed();
      }
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open('manual');
    }

    sellSlot(slotId) {
      const p = this.game.player;
      const curId = p.loadout[slotId];
      if (!curId) return;
      const refund = WEAPONS.getTradeInValue(curId);
      // Adjust hull max HP if selling Hull Plating
      if (slotId === 'hull' && curId === 'hull_plating') {
        p.maxHp = Math.max(100, p.maxHp - 45);
        p.hp = Math.min(p.hp, p.maxHp);
      }
      p.loadout[slotId] = null;
      p.credits += refund;
      XENON.audio.playCashPickup(2);
      this.say('sell', `Sold for +${refund} CR (50% Trade-In)! Slot ${slotId.toUpperCase()} is open!`);
      this.renderInventory();
      this.game.updateCabinetHUD();
    }

    buyHardpoint(itemId, targetSlot) {
      const p = this.game.player;
      const item = WEAPONS.CATALOG[itemId];
      if (!item) return;

      // Determine slot (for wing items, choose selected wing or empty wing or leftWing)
      let slot = targetSlot;
      if (!slot || !WEAPONS.isSlotCompatible(item, slot)) {
        if (item.slot === 'wing') {
          if (this.selectedSlot === 'leftWing' || this.selectedSlot === 'rightWing') {
            slot = this.selectedSlot;
          } else if (!p.loadout.leftWing) {
            slot = 'leftWing';
          } else if (!p.loadout.rightWing) {
            slot = 'rightWing';
          } else {
            slot = 'leftWing';
          }
        } else {
          slot = item.slot;
        }
      }

      if (p.loadout[slot] === itemId) {
        this.say('welcome', `You already have ${item.name} bolted onto ${slot.toUpperCase()}, mate!`);
        return;
      }

      const prevSynCount = WEAPONS.computeActiveSynergies(p.loadout, false).list.length;
      const tradeIn = p.loadout[slot] ? WEAPONS.getTradeInValue(p.loadout[slot]) : 0;
      const netCost = item.cost - tradeIn;

      if (p.credits < netCost) {
        this.say('broke');
        return;
      }

      // Remove old hull bonus if replacing hull_plating
      if (slot === 'hull' && p.loadout.hull === 'hull_plating') {
        p.maxHp = Math.max(100, p.maxHp - 45);
        p.hp = Math.min(p.hp, p.maxHp);
      }

      p.credits -= netCost;
      p.loadout[slot] = itemId;

      if (slot === 'hull' && itemId === 'hull_plating') {
        p.maxHp += 45;
        p.hp = Math.min(p.maxHp, p.hp + 45);
      }
      if (slot === 'hull' && itemId === 'chrono_capacitor') {
        p.maxChrono = 270;
        p.chrono = p.maxChrono;
      } else if (p.loadout.hull !== 'chrono_capacitor') {
        p.maxChrono = 180;
        p.chrono = Math.min(p.chrono, p.maxChrono);
      }

      const newSyn = WEAPONS.computeActiveSynergies(p.loadout, false);
      XENON.audio.playCashPickup(3);

      if (newSyn.list.length > prevSynCount) {
        const newest = newSyn.list[newSyn.list.length - 1];
        this.say('synergy', `GOLDEN SYNERGY ARMED: ${newest.name}! ${newest.desc}`);
      } else {
        this.say('buy');
      }

      this.renderInventory();
      this.game.updateCabinetHUD();
    }

    buySpecial(specialId) {
      const p = this.game.player;
      const spec = WEAPONS.SPECIALS.find((s) => s.id === specialId);
      if (!spec) return;

      if (specialId === 'speed_booster' && p.speedTier >= 4) {
        this.say('welcome', 'Your flight servos are already maxed out at Tier 4, speed-demon!');
        return;
      }
      if (specialId === 'boss_intel' && p.bossIntelStage === this.game.stageNum) {
        this.say('welcome', `Intel already uploaded: ${this.game.stageData.def.bossIntel}`);
        return;
      }

      if (p.credits < spec.cost) {
        this.say('broke');
        return;
      }

      p.credits -= spec.cost;

      if (specialId === 'shield_repair') {
        p.hp = Math.min(p.maxHp, p.hp + 60);
        p.shield = Math.min(p.maxShield, p.shield + 45);
        XENON.audio.playCashPickup(2);
        this.say('buy', 'Hull plates arc-welded and energy shields topped right up!');
      } else if (specialId === 'speed_booster') {
        p.speedTier = Math.min(4, p.speedTier + 1);
        XENON.audio.playCashPickup(2);
        this.say('buy', `Flight servos tuned to Speed Tier ${p.speedTier}! Silky smooth!`);
      } else if (specialId === 'smart_bomb') {
        p.bombs++;
        XENON.audio.playCashPickup(2);
        this.say('buy', 'Megablast Smart Bomb loaded into bay! Press [Q] or [X] in a pinch!');
      } else if (specialId === 'boss_intel') {
        p.bossIntelStage = this.game.stageNum;
        XENON.audio.playCashPickup(3);
        this.say('buy', `BOSS INTEL: ${this.game.stageData.def.bossIntel}`);
      } else if (specialId === 'super_nashwan') {
        // 20 FULL SECONDS (1200 frames @ 60 FPS) OF SUPER NASHWAN POWER!
        p.nashwanTimer = Math.max(p.nashwanTimer, 1200);
        XENON.audio.playNashwanSiren();
        this.say('nashwan');
      }

      this.renderInventory();
      this.game.updateCabinetHUD();
    }

    renderInventory() {
      if (!this.modalEl) return;
      const p = this.game.player;
      const creditsEl = document.getElementById('shop-credits-val');
      if (creditsEl) creditsEl.textContent = `${p.credits} CR`;

      // Highlight active filter tab
      document.querySelectorAll('[data-shop-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-shop-tab') === this.selectedSlot);
      });

      // Render 6 Paper-Doll Hardpoint Slots
      const slotsContainer = document.getElementById('paperdoll-slots');
      if (slotsContainer) {
        slotsContainer.innerHTML = '';
        for (const s of WEAPONS.SLOTS) {
          const eqId = p.loadout[s.id];
          const eqItem = eqId ? WEAPONS.CATALOG[eqId] : null;
          const refund = eqId ? WEAPONS.getTradeInValue(eqId) : 0;

          const card = document.createElement('div');
          card.className = 'pd-slot-card' + (this.selectedSlot === s.id ? ' selected' : '') + (eqItem ? ' equipped' : '');
          card.innerHTML = `
            <div class="pd-slot-head">
              <span class="pd-slot-label">${s.short}</span>
              ${eqItem ? `<button class="pd-sell-btn" data-sell-slot="${s.id}" title="Sell back to Crispin for 50%">SELL +${refund}</button>` : '<span class="pd-empty-tag">EMPTY</span>'}
            </div>
            <div class="pd-slot-item">${eqItem ? eqItem.name : '— Click to Bolt On —'}</div>
          `;
          card.addEventListener('click', (e) => {
            if (e.target && e.target.hasAttribute('data-sell-slot')) {
              e.stopPropagation();
              this.sellSlot(s.id);
              return;
            }
            this.selectedSlot = s.id;
            this.renderInventory();
          });
          slotsContainer.appendChild(card);
        }
      }

      // Render Synergy Status Strip inside Shop
      const synContainer = document.getElementById('shop-synergies');
      if (synContainer) {
        const activeSyn = WEAPONS.computeActiveSynergies(p.loadout, p.nashwanTimer > 0);
        synContainer.innerHTML = WEAPONS.SYNERGY_DEFS.map((syn) => {
          const isOn = !!activeSyn[syn.id === 'prism_matrix' ? 'prism_matrix' : syn.id === 'chrono_nova' ? 'chrono_nova' : 'tesla_swarm'];
          return `
            <div class="syn-chip ${isOn ? 'active' : ''}" title="${syn.desc}">
              <span class="syn-star">${isOn ? '★ ACTIVE' : '◇ COMBO'}</span>
              <strong>${syn.name}</strong>
              <small>${syn.reqText}</small>
            </div>
          `;
        }).join('');
      }

      // Render Upgrade Cards + Crispin's Specials
      const grid = document.getElementById('shop-items-grid');
      if (!grid) return;
      grid.innerHTML = '';

      // 1. Modular Hardpoint Weapons & Hulls
      if (this.selectedSlot !== 'specials') {
        Object.values(WEAPONS.CATALOG).forEach((item) => {
          if (this.selectedSlot !== 'all') {
            if (!WEAPONS.isSlotCompatible(item, this.selectedSlot)) return;
          }

          // Compute target slot & trade-in preview
          let targetSlot = item.slot;
          if (item.slot === 'wing') {
            if (this.selectedSlot === 'leftWing' || this.selectedSlot === 'rightWing') {
              targetSlot = this.selectedSlot;
            } else {
              targetSlot = !p.loadout.leftWing ? 'leftWing' : (!p.loadout.rightWing ? 'rightWing' : 'leftWing');
            }
          }

          const alreadyOnTarget = p.loadout[targetSlot] === item.id;
          const tradeIn = (!alreadyOnTarget && p.loadout[targetSlot]) ? WEAPONS.getTradeInValue(p.loadout[targetSlot]) : 0;
          const netCost = item.cost - tradeIn;
          const canAfford = p.credits >= netCost;

          const card = document.createElement('div');
          card.className = 'shop-card' + (alreadyOnTarget ? ' installed' : '') + (item.tag.includes('SYNERGY') ? ' synergy-hint' : '');

          let actionBtns = '';
          if (item.slot === 'wing') {
            const trL = p.loadout.leftWing && p.loadout.leftWing !== item.id ? WEAPONS.getTradeInValue(p.loadout.leftWing) : 0;
            const trR = p.loadout.rightWing && p.loadout.rightWing !== item.id ? WEAPONS.getTradeInValue(p.loadout.rightWing) : 0;
            const netL = item.cost - trL;
            const netR = item.cost - trR;
            const labelL = p.loadout.leftWing === item.id ? 'L-WING ✓' : (netL <= 0 ? `L-WING +${Math.abs(netL)} CR` : `L-WING ${netL} CR${trL ? '*' : ''}`);
            const labelR = p.loadout.rightWing === item.id ? 'R-WING ✓' : (netR <= 0 ? `R-WING +${Math.abs(netR)} CR` : `R-WING ${netR} CR${trR ? '*' : ''}`);
            actionBtns = `
              <div class="wing-btn-row">
                <button class="buy-btn ${p.loadout.leftWing === item.id ? 'equipped' : ''}" data-buy="${item.id}" data-slot="leftWing" ${p.loadout.leftWing !== item.id && p.credits < netL ? 'disabled' : ''}>
                  ${labelL}
                </button>
                <button class="buy-btn ${p.loadout.rightWing === item.id ? 'equipped' : ''}" data-buy="${item.id}" data-slot="rightWing" ${p.loadout.rightWing !== item.id && p.credits < netR ? 'disabled' : ''}>
                  ${labelR}
                </button>
              </div>
            `;
          } else {
            const singleLabel = alreadyOnTarget
              ? 'EQUIPPED ✓'
              : (netCost <= 0
                  ? `SWAP (+${Math.abs(netCost)} CR BACK)`
                  : `BOLT ON: ${netCost} CR${tradeIn > 0 ? ` (-${tradeIn} TRADE)` : ''}`);
            actionBtns = `
              <button class="buy-btn ${alreadyOnTarget ? 'equipped' : ''}" data-buy="${item.id}" data-slot="${targetSlot}" ${!alreadyOnTarget && !canAfford ? 'disabled' : ''}>
                ${singleLabel}
              </button>
            `;
          }

          card.innerHTML = `
            <div class="shop-card-top">
              <span class="shop-item-name">${item.name}</span>
              <span class="shop-item-tag">${item.tag}</span>
            </div>
            <p class="shop-item-desc">${item.desc}</p>
            <div class="shop-card-foot">
              <span class="shop-base-val">List: ${item.cost} CR</span>
              ${actionBtns}
            </div>
          `;
          grid.appendChild(card);
        });
      }

      // 2. Crispin's Specials, Repairs, Boss Intel & SUPER NASHWAN POWER
      if (this.selectedSlot === 'all' || this.selectedSlot === 'specials') {
        WEAPONS.SPECIALS.forEach((spec) => {
          const isNashwan = spec.id === 'super_nashwan';
          const ownedIntel = spec.id === 'boss_intel' && p.bossIntelStage === this.game.stageNum;
          const maxedSpeed = spec.id === 'speed_booster' && p.speedTier >= 4;
          const canAfford = p.credits >= spec.cost;

          const card = document.createElement('div');
          card.className = 'shop-card special-card' + (isNashwan ? ' nashwan-card' : '');
          card.innerHTML = `
            <div class="shop-card-top">
              <span class="shop-item-name">${spec.name}</span>
              <span class="shop-item-tag">${spec.tag}</span>
            </div>
            <p class="shop-item-desc">${ownedIntel ? ('INTEL: ' + this.game.stageData.def.bossIntel) : spec.desc}</p>
            <div class="shop-card-foot">
              <span class="shop-base-val">${spec.cost} CR</span>
              <button class="buy-btn" data-special="${spec.id}" ${(ownedIntel || maxedSpeed || !canAfford) ? 'disabled' : ''}>
                ${ownedIntel ? 'INTEL ACTIVE ✓' : maxedSpeed ? 'MAX TIER 4 ✓' : `BUY ${spec.cost} CR`}
              </button>
            </div>
          `;
          grid.appendChild(card);
        });
      }

      grid.querySelectorAll('[data-buy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.buyHardpoint(btn.getAttribute('data-buy'), btn.getAttribute('data-slot'));
        });
      });
      grid.querySelectorAll('[data-special]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.buySpecial(btn.getAttribute('data-special'));
        });
      });
    }

    // Animates Crispin's VGA Portrait & Live Ship Hardpoint Paper-Doll at 60 FPS!
    updateAndRender() {
      if (!this.isOpen) return;
      this.previewTick++;

      let jawOpen = 0;
      if (this.speechTimer > 0) {
        this.speechTimer--;
        jawOpen = Math.abs(Math.sin(this.speechTimer * 0.55));
        if (this.speechTimer % 6 === 0) {
          XENON.audio.playCrispinBlip(this.blipCounter++);
        }
      }

      if (this.portraitCtx) {
        XENON.renderCrispinPortrait(this.portraitCtx, this.portraitCanvas.width, this.portraitCanvas.height, {
          time: this.previewTick / 60,
          beatPulse: XENON.audio.beatPulse,
          jawOpen,
          spectrum: XENON.audio.freqData
        });
      }

      // Render live Megablaster with all bolted-on hardpoints inside Paper-Doll preview!
      if (this.paperDollFb) {
        const fb = this.paperDollFb;
        fb.clear(PALETTE[RAMP.STEEL + 1]);
        // Blueprint schematic grid
        for (let y = 0; y < 200; y += 16) fb.hline(0, y, 320, PALETTE[RAMP.STEEL + 3]);
        for (let x = 0; x < 320; x += 16) fb.vline(x, 0, 200, PALETTE[RAMP.STEEL + 3]);
        fb.drawBevelBox(4, 4, 312, 192, RAMP.CHROME);
        fb.drawTextCentered('MEGABLASTER LIVE HARDPOINT RIG', 11, PALETTE[RAMP.CYAN + 13]);

        // Render ship centered at (160, 108) with live demo weapon fire pulses!
        const cx = 160;
        const cy = 108;
        this.game.renderShipSpriteAt(fb, cx, cy, 0, this.previewTick, true);

        // Animated hardpoint callout lines
        const calloutCol = PALETTE[RAMP.BRASS + 12];
        fb.drawLine(cx, cy - 16, cx, 36, calloutCol);
        fb.drawTextCentered('NOSE', 28, PALETTE[14]);

        fb.drawLine(cx - 15, cy, 46, cy - 18, calloutCol);
        fb.drawText('L-WING', 14, cy - 22, PALETTE[14]);

        fb.drawLine(cx + 15, cy, 274, cy - 18, calloutCol);
        fb.drawText('R-WING', 276, cy - 22, PALETTE[14]);

        fb.drawLine(cx, cy + 16, cx, 168, calloutCol);
        fb.drawTextCentered('TAIL / THRUSTERS', 173, PALETTE[14]);

        fb.present();
      }
    }
  }

  XENON.CrispinShopController = CrispinShopController;
})();
