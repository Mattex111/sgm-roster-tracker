/**
 * ==========================================================================
 * SGM Roster Tracker - Main Client Application Script
 * ==========================================================================
 */

// Undo state history stack & meta tier numerical weights
const undoStack = [];
const RANK_VALUES = { 'SS': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'U': 0, 'TBD': 0 };

let wishlistGolds = (INITIAL_WISHLIST && INITIAL_WISHLIST.golds) ? INITIAL_WISHLIST.golds : [];
let wishlistDiamonds = (INITIAL_WISHLIST && INITIAL_WISHLIST.diamonds) ? INITIAL_WISHLIST.diamonds : [];

// Cache initial text for highlighting restore
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.desc-text, .name-text, .char-tag').forEach(el => {
        el.dataset.original = el.innerHTML;
    });
    updateCount();
});

/**
 * Toggle visibility of multiselect dropdown menus.
 * @param {string} id - HTML ID of the target dropdown element.
 */
function toggleDropdown(id) {
    const el = document.getElementById(id);
    const isShown = el.classList.contains('show');
    document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('show'));
    if (!isShown) el.classList.add('show');
}

// Close dropdowns when clicking outside container
window.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-container')) {
        document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('show'));
    }
});

/**
 * Get selected fighter rarity tiers.
 * @returns {Array<string>} Array of selected tier names (e.g. ['Diamond', 'Gold']).
 */
function getSelectedTiers() {
    return Array.from(document.querySelectorAll('#tierDropdown input:checked')).map(cb => cb.value);
}

/**
 * Handle tier dropdown checkbox updates.
 */
function onTierChange() {
    const selected = getSelectedTiers();
    const label = document.getElementById('tierLabel');
    if (selected.length === 0) {
        label.innerText = "All Tiers";
    } else if (selected.length <= 2) {
        label.innerText = selected.join(', ');
    } else {
        label.innerText = `Tiers (${selected.length})`;
    }
    filterAndSortCards();
}

/**
 * Get selected combat modifier (buff/debuff) filters.
 * @returns {Array<string>} Array of lowercase modifier names.
 */
function getSelectedModifiers() {
    return Array.from(document.querySelectorAll('#modifierDropdown input:checked')).map(cb => cb.value.toLowerCase());
}

/**
 * Handle modifier dropdown checkbox updates.
 */
function onModifierChange() {
    const selected = getSelectedModifiers();
    document.getElementById('modifierLabel').innerText = `Modifiers (${selected.length})`;
    filterAndSortCards();
}

/**
 * Update the state of the Undo button based on history stack length.
 */
function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    btn.disabled = undoStack.length === 0;
}

/**
 * Push state entries to the undo history stack.
 * @param {Array<Object>} entries - Array of fighter name and previous state pairs.
 */
function saveSnapshot(entries) {
    undoStack.push(entries);
    updateUndoButton();
}

/**
 * Update total unlocked fighters counter display.
 */
function updateCount() {
    const count = document.querySelectorAll('.card.unlocked').length;
    document.getElementById('unlockCount').innerText = count;
}

/**
 * Set card unlocked styling and data attribute.
 * @param {string} name - Raw fighter name.
 * @param {boolean} status - True if unlocked/owned, false otherwise.
 */
function setCardState(name, status) {
    const card = document.querySelector(`.card[data-rawname="${CSS.escape(name)}"]`);
    if (card) {
        card.dataset.unlocked = status ? 'true' : 'false';
        if (status) card.classList.add('unlocked');
        else card.classList.remove('unlocked');
    }
}

/**
 * Toggle individual card owned/unlocked status.
 * @param {Event} event - Pointer click event.
 * @param {HTMLElement} cardElement - Fighter card DOM node.
 */
function onCardClick(event, cardElement) {
    if (event.target.closest('.inspect-btn') || event.target.closest('details.base-kit')) return;

    const name = cardElement.dataset.rawname;
    const currentState = cardElement.dataset.unlocked === 'true';
    const newState = !currentState;

    saveSnapshot([{ name: name, previousState: currentState }]);

    fetch('/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, unlocked: newState })
    }).then(() => {
        setCardState(name, newState);
        updateCount();
    });
}

/**
 * Open full In-Game Inspector Modal for a selected fighter card.
 * @param {Event} event - Pointer click event.
 * @param {HTMLElement} btnElement - Inspect button DOM node inside card.
 */
function openFighterModal(event, btnElement) {
    event.stopPropagation();
    const card = btnElement.closest('.card');
    const fighter = JSON.parse(card.dataset.fighter);
    const baseKit = JSON.parse(card.dataset.base || '{}');

    document.getElementById('modalFighterName').innerText = fighter.name;
    document.getElementById('modalFighterSub').innerText = `${fighter.character} | ${fighter.tier} | ${fighter.element}`;

    // Set Card Art Image in Modal
    const imgEl = document.getElementById('modalCardImg');
    if (fighter.image_url) {
        imgEl.src = fighter.image_url;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    // Set Max Stats in Modal Header Card
    document.getElementById('modalAtkVal').innerText = fighter.atk_max ? fighter.atk_max.toLocaleString() : 'N/A';
    document.getElementById('modalHpVal').innerText = fighter.hp_max ? fighter.hp_max.toLocaleString() : 'N/A';

    // Info Tab (Signature Abilities)
    document.getElementById('modalSa1').innerText = fighter.sa1 || "N/A";
    document.getElementById('modalSa2').innerText = fighter.sa2 || "N/A";

    // Kit Tab (Prestige & Marquee Abilities)
    const prestigeEl = document.getElementById('modalPrestige');
    if (baseKit.prestige) {
        prestigeEl.innerHTML = `<strong>${baseKit.prestige.name}:</strong> ${baseKit.prestige.description}`;
    } else {
        prestigeEl.innerText = "N/A";
    }

    const marqueeContainer = document.getElementById('modalMarquee');
    marqueeContainer.innerHTML = '';
    if (baseKit.marquee_options && baseKit.marquee_options.length > 0) {
        baseKit.marquee_options.forEach(m => {
            const div = document.createElement('div');
            div.innerHTML = `• <em>${m.name}</em>: ${m.description}`;
            marqueeContainer.appendChild(div);
        });
    } else {
        marqueeContainer.innerText = "N/A";
    }

    // Loadout Tab (Stat Investments & Recommended Moves)
    const statsContainer = document.getElementById('modalStats');
    statsContainer.innerHTML = '';
    if (fighter.loadouts && fighter.loadouts.stat_investment && fighter.loadouts.stat_investment.length > 0) {
        fighter.loadouts.stat_investment.forEach(stat => {
            const div = document.createElement('div');
            div.innerText = `• ${stat}`;
            statsContainer.appendChild(div);
        });
    } else {
        statsContainer.innerText = "No specific stat investment notes.";
    }

    const movesContainer = document.getElementById('modalMoves');
    movesContainer.innerHTML = '';
    if (fighter.loadouts && fighter.loadouts.preferred_moveset && fighter.loadouts.preferred_moveset.length > 0) {
        fighter.loadouts.preferred_moveset.forEach(move => {
            const span = document.createElement('span');
            span.className = 'move-badge';
            span.innerText = move;
            movesContainer.appendChild(span);
        });
    } else {
        movesContainer.innerText = "No preferred moveset specified.";
    }

    document.getElementById('fighterModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Close Inspector Modal when clicking overlay background.
 */
function closeFighterModal(e) {
    if (e.target.id === 'fighterModal') closeFighterModalDirect();
}

/**
 * Close Inspector Modal directly.
 */
function closeFighterModalDirect() {
    document.getElementById('fighterModal').classList.remove('show');
    document.body.style.overflow = '';
}

/**
 * Switch tabs inside Fighter Inspector Modal.
 * @param {Event} event - Tab button click event.
 * @param {string} tabName - Name of pane to activate ('info', 'kit', 'loadout').
 */
function switchModalTab(event, tabName) {
    document.querySelectorAll('.m-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.m-tab-pane').forEach(p => p.style.display = 'none');

    event.target.classList.add('active');
    if (tabName === 'info') {
        document.getElementById('pane-info').style.display = 'flex';
    } else if (tabName === 'kit') {
        document.getElementById('pane-kit').style.display = 'flex';
    } else if (tabName === 'loadout') {
        document.getElementById('pane-loadout').style.display = 'flex';
    }
}

/**
 * Batch toggle all currently visible fighter cards.
 * @param {boolean} status - True to unlock all visible, false to lock.
 */
function batchToggle(status) {
    const visibleCards = Array.from(document.querySelectorAll('.card')).filter(c => c.style.display !== 'none');
    const targetCards = visibleCards.filter(c => (c.dataset.unlocked === 'true') !== status);

    if (targetCards.length === 0) return;

    const actionText = status ? "SELECT" : "DESELECT";
    const confirmed = confirm(`Are you sure you want to ${actionText} all ${targetCards.length} visible fighter(s)?`);
    if (!confirmed) return;

    const snapshot = targetCards.map(c => ({
        name: c.dataset.rawname,
        previousState: c.dataset.unlocked === 'true'
    }));
    saveSnapshot(snapshot);

    const names = targetCards.map(c => c.dataset.rawname);
    fetch('/toggle_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: names, unlocked: status })
    }).then(() => {
        names.forEach(name => setCardState(name, status));
        updateCount();
    });
}

/**
 * Trigger Ctrl+Z Undo for bulk or single toggle changes.
 */
function triggerUndo() {
    if (undoStack.length === 0) return;
    const lastAction = undoStack.pop();
    updateUndoButton();

    fetch('/apply_states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ states: lastAction })
    }).then(() => {
        lastAction.forEach(item => setCardState(item.name, item.previousState));
        updateCount();
    });
}

// Global keydown handler for Undo shortcut (Ctrl+Z / Cmd+Z)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            triggerUndo();
        }
    }
});

/**
 * Toggle Meta Tier Ratings badges display in card view.
 * @param {boolean} show - True to display ratings, false to hide.
 */
function toggleRatingsVisibility(show) {
    document.querySelectorAll('.ratings-row').forEach(el => {
        el.style.display = show ? 'grid' : 'none';
    });
}

/**
 * Check if fighter kit text contains specified combat modifier effect.
 * @param {string} kitText - Raw SA/Kit text content.
 * @param {string} effect - Target modifier keyword.
 * @returns {boolean} True if effect matched.
 */
function doesKitContainEffect(kitText, effect) {
    if (!effect) return true;

    if (effect === 'armor') {
        kitText = kitText.replace(/armor\s+break/gi, '');
        return /\barmors?\b/i.test(kitText);
    }
    if (effect === 'armor break') {
        return /\barmor\s+breaks?\b/i.test(kitText);
    }
    if (effect === 'regen') {
        kitText = kitText.replace(/heavy\s+regen/gi, '');
        return /\bregens?\b/i.test(kitText);
    }
    if (effect === 'heavy regen') {
        return /\bheavy\s+regens?\b/i.test(kitText);
    }
    if (effect === 'bleed') {
        kitText = kitText.replace(/heavy\s+bleed/gi, '');
        return /\bbleeds?\b/i.test(kitText);
    }
    if (effect === 'heavy bleed') {
        return /\bheavy\s+bleeds?\b/i.test(kitText);
    }
    if (effect === 'auto-block' || effect === 'auto block') {
        return /\bauto[- ]?blocks?\b/i.test(kitText);
    }
    if (effect === 'invincible') {
        return /\binvincib(?:le|ility)\b/i.test(kitText);
    }
    if (effect === 'disable blockbuster' || effect === 'disable blockbusters') {
        return /\bdisable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*)blockbusters?\b|\bblockbusters?(?:[^\.\n;]+)?\s+disabled\b/i.test(kitText);
    }
    if (effect === 'disable special' || effect === 'disable specials') {
        return /\bdisable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*(?:(?:tag[\s-]ins?|blockbusters?),?\s*(?:and\s+)?)?)?specials?(?:\s+moves?)?\b|\bspecials?(?:\s+moves?)?\s+disabled\b/i.test(kitText);
    }
    if (effect === 'disable tag' || effect === 'disable tag ins') {
        return /\bdisable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*(?:(?:special\s+moves?|blockbusters?),?\s*(?:and\s+)?)?)?tag(?:[\s-]ins?)?\b|\btags?(?:[\s-]ins?)?\s+disabled\b/i.test(kitText);
    }

    const regex = new RegExp(`\\b${effect}s?\\b`, 'i');
    return regex.test(kitText);
}

/**
 * Apply visual highlights to card text matching active modifier filters or search query.
 * @param {HTMLElement} card - Fighter card element.
 * @param {Array<string>} selectedEffects - List of active modifier filter strings.
 */
function applyHighlights(card, selectedEffects) {
    const textElements = card.querySelectorAll('.desc-text, .name-text, .char-tag');
    const searchQuery = document.getElementById('search').value.trim().toLowerCase();
    const searchWords = searchQuery.length > 1 ? searchQuery.split(/\s+/).filter(w => w.length > 0) : [];

    if (selectedEffects.length === 0 && searchWords.length === 0) {
        textElements.forEach(el => {
            el.innerHTML = el.dataset.original || el.innerHTML;
        });
        return;
    }

    textElements.forEach(el => {
        let html = el.dataset.original || el.innerHTML;

        if (el.classList.contains('desc-text')) {
            selectedEffects.forEach(effect => {
                let pattern;
                if (effect === 'armor') {
                    pattern = /\b(armor)(?!\s+break)\b/gi;
                } else if (effect === 'armor break') {
                    pattern = /\b(armor\s+breaks?)\b/gi;
                } else if (effect === 'regen') {
                    pattern = /(?<!heavy\s+)\b(regens?)\b/gi;
                } else if (effect === 'heavy regen') {
                    pattern = /\b(heavy\s+regens?)\b/gi;
                } else if (effect === 'bleed') {
                    pattern = /(?<!heavy\s+)\b(bleeds?)\b/gi;
                } else if (effect === 'heavy bleed') {
                    pattern = /\b(heavy\s+bleeds?)\b/gi;
                } else if (effect === 'auto-block' || effect === 'auto block') {
                    pattern = /\b(auto[- ]?blocks?)\b/gi;
                } else if (effect === 'invincible') {
                    pattern = /\b(invincib(?:le|ility))\b/gi;
                } else if (effect === 'disable blockbuster' || effect === 'disable blockbusters') {
                    pattern = /\b(disable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*)blockbusters?|blockbusters?(?:[^\.\n;]+)?\s+disabled)\b/gi;
                } else if (effect === 'disable special' || effect === 'disable specials') {
                    pattern = /\b(disable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*(?:(?:tag[\s-]ins?|blockbusters?),?\s*(?:and\s+)?)?)?specials?(?:\s+moves?)?|specials?(?:\s+moves?)?\s+disabled)\b/gi;
                } else if (effect === 'disable tag' || effect === 'disable tag ins') {
                    pattern = /\b(disable[sd]?(?:\s+(?:the\s+)?(?:opponent['’]?s?|their)?\s*(?:(?:special\s+moves?|blockbusters?),?\s*(?:and\s+)?)?)?tag(?:[\s-]ins?)?|tag(?:[\s-]ins?)?\s+disabled)\b/gi;
                } else {
                    pattern = new RegExp(`\\b(${effect}s?)\\b`, 'gi');
                }
                html = html.replace(pattern, '<mark class="effect-highlight">$1</mark>');
            });
        }

        searchWords.forEach(word => {
            if (word.length < 2) return;
            const safeWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const wordPattern = new RegExp(`(${safeWord})`, 'gi');
            html = html.replace(wordPattern, (match) => {
                return `<mark class="effect-highlight">${match}</mark>`;
            });
        });

        el.innerHTML = html;
    });
}

/**
 * Core filter & sort controller. Evaluates all search, dropdown, status, and rank filters.
 */
function filterAndSortCards() {
    const query = document.getElementById('search').value.toLowerCase();
    const char = document.getElementById('charFilter').value;
    const elem = document.getElementById('elementFilter').value;
    const selectedTiers = getSelectedTiers();
    const selectedEffects = getSelectedModifiers();
    const includeBaseKit = document.getElementById('includeBaseKitFilterToggle').checked;
    const status = document.getElementById('statusFilter').value;
    const mode = document.getElementById('modeFilter').value;
    const minRank = parseInt(document.getElementById('rankFilter').value, 10);
    const sortBy = document.getElementById('sortBy').value;

    const grid = document.getElementById('cardGrid');
    const cards = Array.from(document.querySelectorAll('.card'));

    cards.forEach(c => {
        const matchSearch = c.dataset.search.includes(query);
        const matchChar = !char || c.dataset.char === char;
        const matchElem = !elem || c.dataset.element === elem;
        const matchTier = selectedTiers.length === 0 || selectedTiers.includes(c.dataset.tier);

        const targetKit = includeBaseKit ? c.dataset.fullkit : c.dataset.sakit;
        const matchEffect = selectedEffects.every(eff => doesKitContainEffect(targetKit, eff));

        const isUnlocked = c.dataset.unlocked === 'true';
        const rawName = c.dataset.rawname;
        const isWishlist = wishlistGolds.includes(rawName) || wishlistDiamonds.includes(rawName);
        
        const star = c.querySelector('.wishlist-star');
        if (star) star.style.display = isWishlist ? 'block' : 'none';

        let matchStatus = true;
        if (status === 'unlocked') matchStatus = isUnlocked;
        else if (status === 'locked') matchStatus = !isUnlocked;
        else if (status === 'wishlist') matchStatus = isWishlist;
        const isValidTier = c.dataset.tier !== 'Unknown';

        let matchRank = true;
        if (minRank > 0) {
            const p = RANK_VALUES[c.dataset.pfoff] || 0;
            const ro = RANK_VALUES[c.dataset.riftoff] || 0;
            const rd = RANK_VALUES[c.dataset.riftdef] || 0;
            const rl = RANK_VALUES[c.dataset.realms] || 0;

            if (mode === 'any') {
                matchRank = Math.max(p, ro, rd, rl) >= minRank;
            } else if (mode === 'pf_off') {
                matchRank = p >= minRank;
            } else if (mode === 'rift_off') {
                matchRank = ro >= minRank;
            } else if (mode === 'rift_def') {
                matchRank = rd >= minRank;
            } else if (mode === 'realms') {
                matchRank = rl >= minRank;
            }
        }

        const visible = isValidTier && matchSearch && matchChar && matchElem && matchTier && matchEffect && matchStatus && matchRank;
        c.style.display = visible ? 'flex' : 'none';

        if (visible) {
            applyHighlights(c, selectedEffects);
        }
    });

    cards.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        // Calculate relevance score if there is an active search query
        if (query) {
            const getScore = (card) => {
                const name = (card.dataset.name || '').toLowerCase();
                const char = (card.dataset.char || '').toLowerCase();
                
                if (name === query) return 100;
                if (name.startsWith(query)) return 80;
                if (name.includes(query)) return 60;
                if (char === query) return 50;
                if (char.startsWith(query)) return 40;
                if (char.includes(query)) return 30;
                return 0; // Matched in abilities/description only
            };
            
            scoreA = getScore(a);
            scoreB = getScore(b);
        }

        // Always prioritize higher relevance score first
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }

        // Fallback to user-selected dropdown sorting
        const atkA = parseInt(a.dataset.atk, 10) || 0;
        const atkB = parseInt(b.dataset.atk, 10) || 0;
        const hpA = parseInt(a.dataset.hp, 10) || 0;
        const hpB = parseInt(b.dataset.hp, 10) || 0;
        const nameA = a.dataset.name;
        const nameB = b.dataset.name;

        if (sortBy === 'atk_desc') return atkB - atkA;
        if (sortBy === 'atk_asc') {
            if (atkA === 0) return 1;
            if (atkB === 0) return -1;
            return atkA - atkB;
        }
        if (sortBy === 'hp_desc') return hpB - hpA;
        if (sortBy === 'hp_asc') {
            if (hpA === 0) return 1;
            if (hpB === 0) return -1;
            return hpA - hpB;
        }
        if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
        return nameA.localeCompare(nameB);
    });

    cards.forEach(c => grid.appendChild(c));
}

/**
 * Open Roster Export Options Modal.
 */
function openExportModal() {
    document.getElementById('exportModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Close Roster Export Options Modal.
 */
function closeExportModal() {
    document.getElementById('exportModal').classList.remove('show');
    document.body.style.overflow = '';
}

// Close export modal when clicking backdrop
window.addEventListener('click', (e) => {
    const overlay = document.getElementById('exportModal');
    if (e.target === overlay) {
        closeExportModal();
    }
});

/**
 * Format and copy selected roster data to system clipboard.
 */
function executeExport() {
    const scope = document.querySelector('input[name="exportScope"]:checked').value;
    const format = document.querySelector('input[name="exportFormat"]:checked').value;

    fetch('/export_all')
        .then(r => r.json())
        .then(res => {
            const allFighters = res.fighters || {};
            const baseKits = res.base_abilities || {};

            let targets = [];
            const allCards = Array.from(document.querySelectorAll('.card'));

            if (scope === 'visible_unlocked') {
                const visibleCards = allCards.filter(c => c.style.display !== 'none' && c.dataset.unlocked === 'true');
                targets = visibleCards.map(c => allFighters[c.dataset.rawname]).filter(Boolean);
            } else if (scope === 'visible_all') {
                const visibleCards = allCards.filter(c => c.style.display !== 'none');
                targets = visibleCards.map(c => allFighters[c.dataset.rawname]).filter(Boolean);
            } else if (scope === 'all_unlocked') {
                targets = Object.values(allFighters).filter(f => f.unlocked);
            } else if (scope === 'wishlist_only') {
                targets = Object.values(allFighters).filter(f => wishlistGolds.includes(f.name) || wishlistDiamonds.includes(f.name));
            }

            if (targets.length === 0) {
                alert("No fighters matched your chosen export settings!");
                return;
            }

            let outputText = "";

            if (format === 'names') {
                outputText = targets.map(t => t.name).join(', ');
            } else if (format === 'compact') {
                outputText = targets.map(x => {
                    const r = x.ratings || {};
                    const atk = x.atk_max ? (x.atk_max / 1000).toFixed(1) + 'k' : 'N/A';
                    const hp = x.hp_max ? (x.hp_max / 1000).toFixed(1) + 'k' : 'N/A';
                    return `- [${x.character} | ${x.tier} - ${x.element}] ${x.name} (ATK: ${atk} | HP: ${hp} | PF: ${r.pf_off || 'U'} | R-Off: ${r.rift_off || 'U'} | R-Def: ${r.rift_def || 'U'} | Realms: ${r.realms || 'U'})`;
                }).join('\n');
            } else if (format === 'full') {
                const header = "### MY SKULLGIRLS MOBILE ROSTER\n";
                const body = targets.map(x => {
                    let line = `- [${x.character} | ${x.tier} - ${x.element}] ${x.name}:\n`;
                    if (x.atk_max || x.hp_max) {
                        line += `  Base Stats: Max ATK: ${x.atk_max ? x.atk_max.toLocaleString() : 'N/A'}, Max HP: ${x.hp_max ? x.hp_max.toLocaleString() : 'N/A'}\n`;
                    }
                    if (x.ratings) {
                        line += `  Ratings: PF Offense: ${x.ratings.pf_off}, Rift Offense: ${x.ratings.rift_off}, Rift Defense: ${x.ratings.rift_def}, Parallel Realms: ${x.ratings.realms}\n`;
                    }
                    line += `  SA1: ${x.sa1}\n  SA2: ${x.sa2}`;

                    if (baseKits[x.character]) {
                        const b = baseKits[x.character];
                        const paName = b.prestige ? b.prestige.name : 'None';
                        const maNames = (b.marquee_options || []).map(m => m.name).join(' / ');
                        line += `\n  Base Character Kit: Prestige: ${paName} | Marquee Options: ${maNames}`;
                    }
                    return line;
                }).join('\n');
                outputText = header + body;
            }

            navigator.clipboard.writeText(outputText).then(() => {
                closeExportModal();
                alert(`Successfully copied ${targets.length} fighter(s) to clipboard!`);
            });
        })
        .catch(e => console.error("Export error:", e));
}

/* =========================================
   Wishlist Modal Handlers
   ========================================= */
function openWishlistModal() {
    document.getElementById('wishlistModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderWishlistSlots();
}

function closeWishlistModal() {
    document.getElementById('wishlistModal').style.display = 'none';
    document.getElementById('wishlistPicker').style.display = 'none';
    document.body.style.overflow = '';
}

function renderWishlistSlots() {
    const goldContainer = document.getElementById('goldSlots');
    const diamondContainer = document.getElementById('diamondSlots');
    goldContainer.innerHTML = '';
    diamondContainer.innerHTML = '';

    const createSlot = (tier, index, name) => {
        const slot = document.createElement('div');
        slot.className = `wishlist-slot ${tier.toLowerCase()} ${name ? 'filled' : 'empty'}`;
        if (name) {
            const variant = Array.from(document.querySelectorAll('.card')).find(c => c.dataset.rawname === name);
            const imgEl = variant ? variant.querySelector('img') : null;
            const img = imgEl ? imgEl.src : '';
            slot.innerHTML = `
                <button class="remove-btn" onclick="removeFromWishlist('${tier}', ${index}); event.stopPropagation();">×</button>
                ${img ? `<img src="${img}" alt="${name}">` : ''}
                <div class="slot-name">${name}</div>
            `;
        }
        slot.onclick = (e) => openWishlistPicker(e, tier, index);
        return slot;
    };

    for (let i = 0; i < 5; i++) {
        goldContainer.appendChild(createSlot('Gold', i, wishlistGolds[i]));
    }
    for (let i = 0; i < 5; i++) {
        diamondContainer.appendChild(createSlot('Diamond', i, wishlistDiamonds[i]));
    }
    
    // Trigger filter to update stars on grid
    filterAndSortCards();
}

let activePickerTier = null;
let activePickerIndex = null;

function openWishlistPicker(event, tier, index) {
    event.stopPropagation();
    activePickerTier = tier;
    activePickerIndex = index;
    const picker = document.getElementById('wishlistPicker');
    const rect = event.currentTarget.getBoundingClientRect();
    
    let top = rect.bottom + 8;
    let left = rect.left - 40;
    
    if (left + 270 > window.innerWidth) left = window.innerWidth - 280;
    if (left < 10) left = 10;
    if (top + 320 > window.innerHeight) top = rect.top - 310;
    if (top < 10) top = 10;

    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
    picker.style.display = 'block';
    
    const searchInput = document.getElementById('wishlistSearch');
    searchInput.value = '';
    filterWishlistPicker();
    setTimeout(() => searchInput.focus(), 50);
}

function filterWishlistPicker() {
    const query = document.getElementById('wishlistSearch').value.toLowerCase().trim();
    const results = document.getElementById('wishlistPickerResults');
    results.innerHTML = '';
    
    const cards = Array.from(document.querySelectorAll('.card'));
    const matches = cards.filter(c => {
        const t = (c.dataset.tier || '').toLowerCase();
        const searchTxt = (c.dataset.search || '').toLowerCase();
        const rawName = (c.dataset.rawname || '').toLowerCase();
        
        const tierMatch = t === activePickerTier.toLowerCase();
        const searchMatch = !query || searchTxt.includes(query) || rawName.includes(query);
        return tierMatch && searchMatch;
    });
    
    if (matches.length === 0) {
        results.innerHTML = '<div style="color: #8b949e; text-align: center; padding: 12px; font-size: 0.85rem;">No matching fighters found</div>';
        return;
    }

    matches.forEach(c => {
        const name = c.dataset.rawname;
        const imgEl = c.querySelector('img');
        const img = imgEl ? imgEl.src : '';
        const div = document.createElement('div');
        div.className = 'picker-item';
        div.innerHTML = `${img ? `<img src="${img}">` : ''} <span>${name}</span>`;
        div.onclick = (e) => {
            e.stopPropagation();
            if (activePickerTier === 'Gold') wishlistGolds[activePickerIndex] = name;
            if (activePickerTier === 'Diamond') wishlistDiamonds[activePickerIndex] = name;
            
            document.getElementById('wishlistPicker').style.display = 'none';
            saveWishlist();
        };
        results.appendChild(div);
    });
}

function removeFromWishlist(tier, index) {
    if (tier === 'Gold') wishlistGolds[index] = null;
    if (tier === 'Diamond') wishlistDiamonds[index] = null;
    
    // Filter out nulls but keep max 5 slots
    wishlistGolds = wishlistGolds.filter(Boolean);
    wishlistDiamonds = wishlistDiamonds.filter(Boolean);
    saveWishlist();
}

function saveWishlist() {
    fetch('/update_wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ golds: wishlistGolds, diamonds: wishlistDiamonds })
    }).then(() => renderWishlistSlots());
}

// Close picker when clicking outside
document.addEventListener('click', (e) => {
    const picker = document.getElementById('wishlistPicker');
    if (picker && picker.style.display === 'block' && !e.target.closest('.wishlist-slot') && !e.target.closest('#wishlistPicker')) {
        picker.style.display = 'none';
    }
});
