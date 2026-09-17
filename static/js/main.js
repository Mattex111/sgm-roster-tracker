/**
 * ==========================================================================
 * SGM Roster Tracker - Main Client Application Script
 * ==========================================================================
 */

// Undo state history stack & meta tier numerical weights
const undoStack = [];
const RANK_VALUES = { 'SS': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'U': 0, 'TBD': 0 };

let wishlistGolds = (typeof INITIAL_WISHLIST !== 'undefined' && INITIAL_WISHLIST.golds) ? INITIAL_WISHLIST.golds : [];
let wishlistDiamonds = (typeof INITIAL_WISHLIST !== 'undefined' && INITIAL_WISHLIST.diamonds) ? INITIAL_WISHLIST.diamonds : [];
let teamsState = (typeof INITIAL_TEAMS !== 'undefined' && Array.isArray(INITIAL_TEAMS)) ? INITIAL_TEAMS : [];

// Register Service Worker for PWA Offline Caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SGM Service Worker Registered:', reg.scope))
            .catch(err => console.log('Service Worker Registration Error:', err));
    });
}

function initLocalStorageSync() {
    const localRoster = localStorage.getItem('sgm_unlocked_roster');
    if (localRoster) {
        try {
            const unlockedList = JSON.parse(localRoster);
            const unlockedSet = new Set(unlockedList);
            document.querySelectorAll('.card').forEach(card => {
                const name = card.dataset.rawname;
                const isUnlocked = unlockedSet.has(name);
                card.dataset.unlocked = isUnlocked ? 'true' : 'false';
                if (isUnlocked) card.classList.add('unlocked');
                else card.classList.remove('unlocked');
            });
        } catch(e) {}
    } else {
        syncRosterToLocalStorage();
    }

    const localWishlist = localStorage.getItem('sgm_wishlist');
    if (localWishlist) {
        try {
            const w = JSON.parse(localWishlist);
            wishlistGolds = w.golds || wishlistGolds;
            wishlistDiamonds = w.diamonds || wishlistDiamonds;
        } catch(e) {}
    }

    const localTeams = localStorage.getItem('sgm_custom_teams');
    if (localTeams) {
        try {
            teamsState = JSON.parse(localTeams);
        } catch(e) {}
    }
}

function syncRosterToLocalStorage() {
    const unlocked = [];
    document.querySelectorAll('.card[data-unlocked="true"]').forEach(c => {
        if (c.dataset.rawname) unlocked.push(c.dataset.rawname);
    });
    localStorage.setItem('sgm_unlocked_roster', JSON.stringify(unlocked));
}

// Cache initial text for highlighting restore
document.addEventListener('DOMContentLoaded', () => {
    initLocalStorageSync();
    document.querySelectorAll('.desc-text, .name-text, .char-tag').forEach(el => {
        el.dataset.original = el.innerHTML;
    });
    updateCount();
    renderTeams();
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
 * Get selected fighter characters.
 * @returns {Array<string>} Array of character names.
 */
function getSelectedCharacters() {
    return Array.from(document.querySelectorAll('#charDropdown input:checked')).map(cb => cb.value);
}

/**
 * Handle character dropdown checkbox updates.
 */
function onCharChange() {
    const selected = getSelectedCharacters();
    const label = document.getElementById('charLabel');
    if (selected.length === 0) {
        label.innerText = "All Fighters";
    } else if (selected.length <= 2) {
        label.innerText = selected.join(', ');
    } else {
        label.innerText = `Fighters (${selected.length})`;
    }
    filterAndSortCards();
}

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
    const total = document.querySelectorAll('.card').length;
    const unlockEl = document.getElementById('unlockCount');
    if (unlockEl) unlockEl.innerText = count;
    const mobUnlockEl = document.getElementById('mobileUnlockCount');
    if (mobUnlockEl) mobUnlockEl.innerText = `Unlocked: ${count} / ${total}`;
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

    setCardState(name, newState);
    updateCount();
    syncRosterToLocalStorage();

    fetch('/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, unlocked: newState })
    }).catch(() => {});
}

/**
 * Look up detailed card info (character, tier, element, image, unlocked status) by variant name.
 * @param {string} rawName - Raw variant name.
 * @returns {Object|null} Info object or null if card not found in DOM.
 */
function getFighterCardInfo(rawName) {
    if (!rawName) return null;
    const cleanName = rawName.trim();
    const card = document.querySelector(`.card[data-rawname="${CSS.escape ? CSS.escape(cleanName) : cleanName}"]`) || document.querySelector(`.card[data-rawname="${cleanName}"]`);
    if (!card) return null;

    let fighter = {};
    try { fighter = JSON.parse(card.dataset.fighter || '{}'); } catch(e) {}

    const cardImg = card.querySelector('.card-image-wrapper img') || card.querySelector('img');
    const image_url = fighter.image_url || (cardImg ? cardImg.src : '');
    const isUnlocked = card.dataset.unlocked === 'true';
    const tier = card.dataset.tier || fighter.tier || '';
    const element = card.dataset.element || fighter.element || '';
    const character = card.dataset.char || fighter.character || '';

    return {
        name: cleanName,
        character: character,
        tier: tier,
        element: element,
        image_url: image_url,
        isUnlocked: isUnlocked
    };
}

/**
 * Helper to build a rich fighter chip with avatar thumbnail, tier border, and lock/unlock status badge.
 * @param {string} fName - Fighter variant name.
 * @returns {HTMLElement} The created chip DOM element.
 */
function createTeamFighterChip(fName) {
    const chip = document.createElement('span');
    chip.className = 'modal-team-chip clickable';
    chip.onclick = (e) => openFighterModalByName(fName, e);

    const info = getFighterCardInfo(fName);

    if (info) {
        if (info.tier) chip.classList.add(`tier-${info.tier.toLowerCase()}`);
        if (!info.isUnlocked) chip.classList.add('is-locked');
        else chip.classList.add('is-unlocked');

        // Avatar Image
        if (info.image_url) {
            const img = document.createElement('img');
            img.className = 'team-chip-avatar';
            img.src = info.image_url;
            img.alt = fName;
            img.onerror = () => { img.style.display = 'none'; };
            chip.appendChild(img);
        }

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'team-chip-name';
        nameSpan.innerText = fName;
        chip.appendChild(nameSpan);

        // Status Badge (Lock / Checkmark)
        const statusBadge = document.createElement('span');
        statusBadge.className = info.isUnlocked ? 'team-chip-badge unlocked' : 'team-chip-badge locked';
        statusBadge.innerHTML = info.isUnlocked ? '✓' : '🔒';
        statusBadge.title = info.isUnlocked ? `${fName} is Unlocked in your roster` : `${fName} is Locked (Not owned yet)`;
        chip.appendChild(statusBadge);

        chip.title = `Click to inspect ${fName} (${info.isUnlocked ? 'Unlocked' : 'Locked'})`;
    } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'team-chip-name';
        nameSpan.innerText = fName;
        chip.appendChild(nameSpan);
        chip.title = `Click to inspect ${fName}`;
    }

    return chip;
}

let modalHistoryStack = [];
let currentInspectedRawName = null;

/**
 * Reverse lookup to find all recommended team combinations from other fighters
 * where targetRawName is included as a team synergy partner.
 * @param {string} targetRawName - Raw variant name.
 * @returns {Array<Object>} List of objects containing { ownerName, teamGroup }.
 */
function getFeaturedInTeams(targetRawName) {
    if (!targetRawName) return [];
    const results = [];
    const targetClean = targetRawName.trim().toLowerCase();

    document.querySelectorAll('.card').forEach(card => {
        const ownerRawName = card.dataset.rawname;
        if (!ownerRawName || ownerRawName.trim().toLowerCase() === targetClean) return;

        let fighter = {};
        try { fighter = JSON.parse(card.dataset.fighter || '{}'); } catch(e) {}
        const loadouts = fighter.loadouts || {};
        const teamComps = loadouts.team_combinations || [];

        teamComps.forEach(teamGroup => {
            if (!Array.isArray(teamGroup)) return;

            let isFeatured = false;
            teamGroup.forEach(slotItem => {
                const choices = Array.isArray(slotItem) ? slotItem : [slotItem];
                choices.forEach(choice => {
                    if (typeof choice === 'string' && choice.trim().toLowerCase() === targetClean) {
                        isFeatured = true;
                    }
                });
            });

            if (isFeatured) {
                results.push({
                    ownerName: ownerRawName,
                    teamGroup: teamGroup
                });
            }
        });
    });

    return results;
}

/**
 * Open full In-Game Inspector Modal by raw fighter name.
 * @param {string} rawName - Raw variant name.
 * @param {Event} [event] - Optional pointer event.
 */
function openFighterModalByName(rawName, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    if (!rawName) return;
    let card = null;
    try {
        if (window.CSS && CSS.escape) {
            card = document.querySelector(`.card[data-rawname="${CSS.escape(rawName)}"]`);
        }
    } catch(e) {}
    if (!card) {
        const allCards = Array.from(document.querySelectorAll('.card'));
        card = allCards.find(c => c.dataset.rawname === rawName);
    }
    if (card) {
        openFighterModalFromCard(card);
    }
}

/**
 * Open full In-Game Inspector Modal for a selected fighter card element.
 * @param {Event} event - Pointer click event.
 * @param {HTMLElement} btnElement - Inspect button DOM node inside card.
 */
function openFighterModal(event, btnElement) {
    if (event) event.stopPropagation();
    const card = btnElement.closest('.card');
    if (card) {
        openFighterModalFromCard(card);
    }
}

/**
 * Populate and display Inspector Modal from a card element.
 * @param {HTMLElement} card - Card DOM element.
 * @param {boolean} [isBackNavigation=false] - Whether this call is popping from history stack.
 */
function openFighterModalFromCard(card, isBackNavigation = false) {
    let fighter = {};
    let baseKit = {};
    try {
        fighter = JSON.parse(card.dataset.fighter || '{}');
    } catch(e) {}
    try {
        baseKit = JSON.parse(card.dataset.base || '{}');
    } catch(e) {}

    const targetRawName = card.dataset.rawname || fighter.name || 'Fighter';
    const modalEl = document.getElementById('fighterModal');
    const isModalOpen = modalEl && modalEl.classList.contains('show');

    if (isModalOpen && !isBackNavigation && currentInspectedRawName && currentInspectedRawName !== targetRawName) {
        modalHistoryStack.push(currentInspectedRawName);
    } else if (!isModalOpen && !isBackNavigation) {
        modalHistoryStack = [];
    }
    currentInspectedRawName = targetRawName;

    // Update Back Button state
    const backBtn = document.getElementById('modalBackBtn');
    if (backBtn) {
        if (modalHistoryStack.length > 0) {
            const prevName = modalHistoryStack[modalHistoryStack.length - 1];
            backBtn.style.display = 'flex';
            backBtn.innerHTML = `← Back (${prevName})`;
            backBtn.title = `Back to ${prevName}`;
        } else {
            backBtn.style.display = 'none';
        }
    }

    document.getElementById('modalFighterName').innerText = fighter.name || card.dataset.rawname || 'Fighter';
    document.getElementById('modalFighterSub').innerText = `${fighter.character || card.dataset.char || ''} | ${fighter.tier || card.dataset.tier || ''} | ${fighter.element || card.dataset.element || ''}`;

    // Set Card Art Image in Modal
    const imgEl = document.getElementById('modalCardImg');
    if (fighter.image_url) {
        imgEl.src = fighter.image_url;
        imgEl.style.display = 'block';
    } else {
        const cardImg = card.querySelector('img');
        if (cardImg) {
            imgEl.src = cardImg.src;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }

    // Set Max Stats in Modal Header Card
    document.getElementById('modalAtkVal').innerText = fighter.atk_max ? fighter.atk_max.toLocaleString() : (card.dataset.atk ? parseInt(card.dataset.atk).toLocaleString() : 'N/A');
    document.getElementById('modalHpVal').innerText = fighter.hp_max ? fighter.hp_max.toLocaleString() : (card.dataset.hp ? parseInt(card.dataset.hp).toLocaleString() : 'N/A');

    // Tab 1: OVERVIEW (Signature & Kit)
    document.getElementById('modalSa1').innerText = fighter.sa1 || "N/A";
    document.getElementById('modalSa2').innerText = fighter.sa2 || "N/A";

    const charAbilityEl = document.getElementById('modalCharAbility');
    if (charAbilityEl) {
        if (baseKit.character_ability) {
            charAbilityEl.innerHTML = `<strong>${baseKit.character_ability.name}:</strong> ${baseKit.character_ability.description}`;
        } else {
            charAbilityEl.innerText = "N/A";
        }
    }

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

    // Tab 2: RATINGS
    const ratingsGrid = document.getElementById('modalRatingsGrid');
    if (ratingsGrid) {
        ratingsGrid.innerHTML = '';
        const r = fighter.ratings || {
            pf_off: card.dataset.pfoff || 'U',
            rift_off: card.dataset.riftoff || 'U',
            rift_def: card.dataset.riftdef || 'U',
            realms: card.dataset.realms || 'U'
        };
        const ratingsData = [
            { label: 'PF Offense', rank: (r.pf_off || 'U').trim() },
            { label: 'Rift Offense', rank: (r.rift_off || 'U').trim() },
            { label: 'Rift Defense', rank: (r.rift_def || 'U').trim() },
            { label: 'Parallel Realms', rank: (r.realms || 'U').trim() }
        ];
        ratingsData.forEach(item => {
            const box = document.createElement('div');
            box.className = 'modal-rate-item';
            box.innerHTML = `
                <span style="color:#8b949e; font-size:0.85rem;">${item.label}</span>
                <span class="rank-badge rank-${item.rank}" style="font-size:1rem; padding:4px 10px;">${item.rank}</span>
            `;
            ratingsGrid.appendChild(box);
        });
    }

    // Loadouts object fallback
    const loadouts = fighter.loadouts || {};

    // Tab 3: STRATEGY & RIFT
    const roleContainer = document.getElementById('modalRoleStrategy');
    roleContainer.innerHTML = '';
    const roleList = loadouts.role_strategy || [];
    if (roleList.length > 0) {
        document.getElementById('boxRoleStrategy').style.display = 'block';
        roleList.forEach(bullet => {
            const div = document.createElement('div');
            div.className = 'bullet-item';
            div.innerText = `• ${bullet}`;
            roleContainer.appendChild(div);
        });
    } else {
        document.getElementById('boxRoleStrategy').style.display = 'block';
        roleContainer.innerHTML = '<div style="color:#8b949e; font-size:0.88rem;">No role & strategy guide specified for this variant yet.</div>';
    }

    // Rift Battles section (dynamic show/hide)
    const riftBox = document.getElementById('boxRiftBattles');
    const riftContainer = document.getElementById('modalRiftBattles');
    const riftList = loadouts.rift_battles || [];
    if (riftContainer) riftContainer.innerHTML = '';
    if (riftList.length > 0) {
        if (riftBox) riftBox.style.display = 'block';
        riftList.forEach(bullet => {
            const div = document.createElement('div');
            div.className = 'bullet-item';
            div.innerText = `• ${bullet}`;
            if (riftContainer) riftContainer.appendChild(div);
        });
    } else {
        if (riftBox) riftBox.style.display = 'none';
    }

    // Playing Against section (dynamic show/hide)
    const counterBox = document.getElementById('boxPlayingAgainst');
    const counterContainer = document.getElementById('modalPlayingAgainst');
    const counterList = loadouts.playing_against || [];
    if (counterContainer) counterContainer.innerHTML = '';
    if (counterList.length > 0) {
        if (counterBox) counterBox.style.display = 'block';
        counterList.forEach(bullet => {
            const div = document.createElement('div');
            div.className = 'bullet-item';
            div.innerText = `• ${bullet}`;
            if (counterContainer) counterContainer.appendChild(div);
        });
    } else {
        if (counterBox) counterBox.style.display = 'none';
    }

    // Tab 4: BUILD & TEAMS
    const statBox = document.getElementById('boxStatInvestment');
    const statsContainer = document.getElementById('modalStats');
    statsContainer.innerHTML = '';
    const statList = loadouts.stat_investment || [];
    if (statList.length > 0) {
        if (statBox) statBox.style.display = 'block';
        statList.forEach(stat => {
            const div = document.createElement('div');
            div.className = 'bullet-item';
            div.innerText = `• ${stat}`;
            statsContainer.appendChild(div);
        });
    } else {
        if (statBox) statBox.style.display = 'block';
        statsContainer.innerHTML = '<div style="color:#8b949e; font-size:0.88rem;">No specific stat investment notes specified.</div>';
    }

    // Moveset categories container
    const movesetsContainer = document.getElementById('modalMovesetsContainer');
    movesetsContainer.innerHTML = '';
    const movesetsMap = loadouts.movesets || {};

    if (Object.keys(movesetsMap).length > 0) {
        for (const [catName, item] of Object.entries(movesetsMap)) {
            if (!item || item.length === 0) continue;
            
            let setups = [];
            if (Array.isArray(item[0])) {
                setups = item;
            } else {
                setups = [item];
            }

            setups.forEach((setupMoves, idx) => {
                const catWrapper = document.createElement('div');
                catWrapper.className = 'moveset-cat-wrapper';
                
                const catTitle = document.createElement('div');
                catTitle.className = 'moveset-cat-title';
                const label = setups.length > 1 ? `${catName} (Setup ${idx + 1})` : catName;
                catTitle.innerText = label;
                
                const badgesDiv = document.createElement('div');
                badgesDiv.className = 'moveset-badges';
                setupMoves.forEach(m => {
                    const span = document.createElement('span');
                    span.className = 'move-badge';
                    span.innerText = m;
                    badgesDiv.appendChild(span);
                });
                
                catWrapper.appendChild(catTitle);
                catWrapper.appendChild(badgesDiv);
                movesetsContainer.appendChild(catWrapper);
            });
        }
    } else if (loadouts.preferred_moveset && loadouts.preferred_moveset.length > 0) {
        const catWrapper = document.createElement('div');
        catWrapper.className = 'moveset-cat-wrapper';
        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'moveset-badges';
        loadouts.preferred_moveset.forEach(m => {
            const span = document.createElement('span');
            span.className = 'move-badge';
            span.innerText = m;
            badgesDiv.appendChild(span);
        });
        catWrapper.appendChild(badgesDiv);
        movesetsContainer.appendChild(catWrapper);
    } else {
        movesetsContainer.innerHTML = '<div style="color:#8b949e; font-size:0.88rem;">No preferred moveset specified.</div>';
    }

    // Team Combinations section (direct)
    const teamBox = document.getElementById('boxTeamComps');
    const teamContainer = document.getElementById('modalTeamComps');
    const teamList = loadouts.team_combinations || [];
    if (teamContainer) teamContainer.innerHTML = '';
    if (teamList.length > 0) {
        if (teamBox) teamBox.style.display = 'block';
        teamList.forEach(teamGroup => {
            if (!Array.isArray(teamGroup) || teamGroup.length === 0) return;

            const teamRow = document.createElement('div');
            teamRow.className = 'modal-team-combo-row';

            const slots = teamGroup.map(item => Array.isArray(item) ? item : [item]);

            slots.forEach((slotFighters, slotIdx) => {
                const slotBox = document.createElement('div');
                slotBox.className = 'team-slot-box';

                slotFighters.forEach((fName, fIdx) => {
                    const chip = createTeamFighterChip(fName);
                    slotBox.appendChild(chip);

                    if (fIdx < slotFighters.length - 1) {
                        const orSpan = document.createElement('span');
                        orSpan.className = 'team-chip-or';
                        orSpan.innerText = 'or';
                        slotBox.appendChild(orSpan);
                    }
                });

                teamRow.appendChild(slotBox);

                if (slotIdx < slots.length - 1) {
                    const plus = document.createElement('span');
                    plus.className = 'team-chip-plus';
                    plus.innerText = '+';
                    teamRow.appendChild(plus);
                }
            });

            if (teamContainer) teamContainer.appendChild(teamRow);
        });
    } else {
        if (teamBox) teamBox.style.display = 'none';
    }

    // Featured In Teams section (Synergy / Reverse lookup)
    const featuredBox = document.getElementById('boxFeaturedTeamComps');
    const featuredContainer = document.getElementById('modalFeaturedTeamComps');
    const featuredList = getFeaturedInTeams(targetRawName);

    if (featuredContainer) featuredContainer.innerHTML = '';
    if (featuredList.length > 0) {
        if (featuredBox) featuredBox.style.display = 'block';
        featuredList.forEach(item => {
            const teamRow = document.createElement('div');
            teamRow.className = 'modal-team-combo-row';

            const ownerBadge = document.createElement('span');
            ownerBadge.className = 'featured-owner-label';
            ownerBadge.innerHTML = `⭐ <strong>${item.ownerName}</strong>'s Team:`;
            teamRow.appendChild(ownerBadge);

            const slots = item.teamGroup.map(slot => Array.isArray(slot) ? slot : [slot]);
            slots.forEach((slotFighters, slotIdx) => {
                const slotBox = document.createElement('div');
                slotBox.className = 'team-slot-box';

                slotFighters.forEach((fName, fIdx) => {
                    const chip = createTeamFighterChip(fName);
                    if (fName.trim().toLowerCase() === targetRawName.trim().toLowerCase()) {
                        chip.style.borderColor = '#a371f7';
                        chip.style.boxShadow = '0 0 6px rgba(163, 113, 247, 0.4)';
                    }
                    slotBox.appendChild(chip);

                    if (fIdx < slotFighters.length - 1) {
                        const orSpan = document.createElement('span');
                        orSpan.className = 'team-chip-or';
                        orSpan.innerText = 'or';
                        slotBox.appendChild(orSpan);
                    }
                });

                teamRow.appendChild(slotBox);

                if (slotIdx < slots.length - 1) {
                    const plus = document.createElement('span');
                    plus.className = 'team-chip-plus';
                    plus.innerText = '+';
                    teamRow.appendChild(plus);
                }
            });

            if (featuredContainer) featuredContainer.appendChild(teamRow);
        });
    } else {
        if (featuredBox) featuredBox.style.display = 'none';
    }

    // Reset active tab to Overview ('info')
    const firstTabBtn = document.querySelector('.modal-tabs .m-tab-btn');
    if (firstTabBtn) {
        switchModalTab({ currentTarget: firstTabBtn }, 'info');
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
    const remainingModal = document.querySelector('.modal-overlay.show, .fighter-modal-overlay.show, #teamFighterPicker.show, #wishlistPicker.show');
    if (!remainingModal) {
        document.body.style.overflow = '';
    }
    modalHistoryStack = [];
    currentInspectedRawName = null;
    const backBtn = document.getElementById('modalBackBtn');
    if (backBtn) backBtn.style.display = 'none';
}

/**
 * Pop previous fighter from navigation history stack and re-inspect it.
 */
function popFighterModalHistory() {
    if (modalHistoryStack.length === 0) return;
    const prevRawName = modalHistoryStack.pop();
    const card = document.querySelector(`.card[data-rawname="${CSS.escape ? CSS.escape(prevRawName) : prevRawName}"]`) || document.querySelector(`.card[data-rawname="${prevRawName}"]`);
    if (card) {
        openFighterModalFromCard(card, true);
    }
}

/**
 * Switch tabs inside Fighter Inspector Modal.
 * @param {Event} event - Tab button click event.
 * @param {string} tabName - Name of pane to activate ('info', 'ratings', 'strategy', 'build').
 */
function switchModalTab(event, tabName) {
    document.querySelectorAll('.m-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.m-tab-pane').forEach(p => p.style.display = 'none');

    const btn = event.currentTarget || event.target;
    if (btn) btn.classList.add('active');
    
    const paneMap = {
        'info': 'pane-info',
        'ratings': 'pane-ratings',
        'strategy': 'pane-strategy',
        'build': 'pane-build'
    };
    
    const targetPaneId = paneMap[tabName] || 'pane-info';
    const targetPane = document.getElementById(targetPaneId);
    if (targetPane) {
        targetPane.style.display = 'flex';
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
    names.forEach(name => setCardState(name, status));
    updateCount();
    syncRosterToLocalStorage();

    fetch('/toggle_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: names, unlocked: status })
    }).catch(() => {});
}

/**
 * Trigger Ctrl+Z Undo for bulk or single toggle changes.
 */
function triggerUndo() {
    if (undoStack.length === 0) return;
    const lastAction = undoStack.pop();
    updateUndoButton();

    lastAction.forEach(item => setCardState(item.name, item.previousState));
    updateCount();
    syncRosterToLocalStorage();

    fetch('/apply_states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ states: lastAction })
    }).catch(() => {});
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
 * Reset all search inputs, dropdown filters, multi-selects, and sort options to default.
 */
function resetAllFilters() {
    const searchInput = document.getElementById('search');
    if (searchInput) searchInput.value = '';

    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) sortSelect.value = 'name_asc';

    document.querySelectorAll('#charDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    const charLabel = document.getElementById('charLabel');
    if (charLabel) charLabel.innerText = 'All Fighters';

    const elementSelect = document.getElementById('elementFilter');
    if (elementSelect) elementSelect.value = '';

    document.querySelectorAll('#tierDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    const tierLabel = document.getElementById('tierLabel');
    if (tierLabel) tierLabel.innerText = 'All Tiers';

    document.querySelectorAll('#modifierDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    const modifierLabel = document.getElementById('modifierLabel');
    if (modifierLabel) modifierLabel.innerText = 'Modifiers (0)';

    const statusSelect = document.getElementById('statusFilter');
    if (statusSelect) statusSelect.value = '';

    const modeSelect = document.getElementById('modeFilter');
    if (modeSelect) modeSelect.value = 'any';

    const rankSelect = document.getElementById('rankFilter');
    if (rankSelect) rankSelect.value = '0';

    filterAndSortCards();
}

/**
 * Core filter & sort controller. Evaluates all search, dropdown, status, and rank filters.
 */
function filterAndSortCards() {
    const query = document.getElementById('search').value.toLowerCase();
    const selectedChars = getSelectedCharacters();
    const elem = document.getElementById('elementFilter').value;
    const selectedTiers = getSelectedTiers();
    const selectedEffects = getSelectedModifiers();
    const includeBaseKit = document.getElementById('includeBaseKitFilterToggle').checked;
    const status = document.getElementById('statusFilter').value;
    const mode = document.getElementById('modeFilter').value;
    const minRank = parseInt(document.getElementById('rankFilter').value, 10);
    const sortBy = document.getElementById('sortBy').value;

    // Update active filter badge for mobile view
    let activeCount = 0;
    if (query) activeCount++;
    if (selectedChars.length > 0) activeCount++;
    if (elem) activeCount++;
    if (selectedTiers.length > 0) activeCount++;
    if (selectedEffects.length > 0) activeCount++;
    if (status) activeCount++;
    if (mode !== 'any') activeCount++;
    if (minRank > 0) activeCount++;

    const badge = document.getElementById('mobileFilterBadge');
    if (badge) {
        if (activeCount > 0) {
            badge.innerText = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    const grid = document.getElementById('cardGrid');
    const cards = Array.from(document.querySelectorAll('.card'));

    cards.forEach(c => {
        const targetSearch = includeBaseKit
            ? (c.dataset.search || '')
            : (c.dataset.sasearch || (c.dataset.name + ' ' + c.dataset.char + ' ' + c.dataset.sakit).toLowerCase());
        const matchSearch = targetSearch.includes(query);
        const matchChar = selectedChars.length === 0 || selectedChars.includes(c.dataset.char);
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

function triggerExport() {
    const teamsView = document.getElementById('teamsView');
    if (teamsView && teamsView.classList.contains('active')) {
        openExportTeamsModal();
    } else {
        openExportModal();
    }
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

/**
 * Open Team Export Options Modal.
 */
function openExportTeamsModal() {
    const modal = document.getElementById('exportTeamsModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close Team Export Options Modal.
 */
function closeExportTeamsModal() {
    const modal = document.getElementById('exportTeamsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Close export modals when clicking backdrop
window.addEventListener('click', (e) => {
    const rosterOverlay = document.getElementById('exportModal');
    if (e.target === rosterOverlay) {
        closeExportModal();
    }
    const teamsOverlay = document.getElementById('exportTeamsModal');
    if (e.target === teamsOverlay) {
        closeExportTeamsModal();
    }
});

function getFighterDetails(rawName) {
    if (!rawName) return null;
    const card = document.querySelector(`.card[data-rawname="${CSS.escape ? CSS.escape(rawName) : rawName}"]`) || document.querySelector(`.card[data-rawname="${rawName}"]`);
    if (card) {
        let fData = {};
        try {
            fData = JSON.parse(card.dataset.fighter || '{}');
        } catch(e) {}
        return {
            name: card.dataset.rawname || rawName,
            character: card.dataset.char || 'Fighter',
            tier: card.dataset.tier || '',
            element: card.dataset.element || '',
            unlocked: card.dataset.unlocked === 'true',
            sa1: fData.sa1 || '',
            sa2: fData.sa2 || '',
            pfoff: card.dataset.pfoff || 'U',
            riftoff: card.dataset.riftoff || 'U',
            riftdef: card.dataset.riftdef || 'U',
            realms: card.dataset.realms || 'U'
        };
    }
    return { name: rawName, character: 'Fighter', tier: '', element: '', unlocked: true, sa1: '', sa2: '', pfoff: 'U', riftoff: 'U', riftdef: 'U', realms: 'U' };
}

/**
 * Format and copy selected teams data to system clipboard.
 */
function executeTeamExport() {
    const scope = document.querySelector('input[name="exportTeamsScope"]:checked').value;
    const format = document.querySelector('input[name="exportTeamsFormat"]:checked').value;
    const selectedMode = document.getElementById('teamModeFilter').value;

    let targetTeams = [...teamsState];
    if (scope === 'visible_teams' && selectedMode) {
        targetTeams = targetTeams.filter(t => t.mode === selectedMode);
    }

    if (targetTeams.length === 0) {
        alert("No saved teams found matching the selected export scope.");
        return;
    }

    let resultText = "";

    if (format === 'full') {
        const lines = ["# 🛡️ Custom Teams Loadouts\n"];
        targetTeams.forEach((t, i) => {
            lines.push(`## ${i + 1}. ${t.name} (${t.mode.toUpperCase()})`);
            const modeKey = getModeAttrKey(t.mode);
            t.fighters.forEach((fName, idx) => {
                if (fName) {
                    const info = getFighterDetails(fName);
                    const rank = (info[modeKey] || 'U').trim();
                    lines.push(`• Fighter ${idx + 1}: ${info.name} (${info.character} - ${info.tier} - ${info.element}) [Rank: ${rank}]${info.unlocked ? '' : ' (🔒 Locked)'}`);
                    if (info.sa1) lines.push(`  - SA1: ${info.sa1}`);
                    if (info.sa2) lines.push(`  - SA2: ${info.sa2}`);
                } else {
                    lines.push(`• Fighter ${idx + 1}: [Empty Slot]`);
                }
            });
            lines.push("");
        });
        resultText = lines.join("\n");
    } else if (format === 'compact') {
        const lines = ["# 🛡️ Custom Teams Summary\n"];
        targetTeams.forEach((t, i) => {
            const fighterDetails = t.fighters.filter(Boolean).map(fName => {
                const info = getFighterDetails(fName);
                return `${info.name} (${info.character} - ${info.tier} - ${info.element})`;
            }).join(", ");
            lines.push(`• ${t.name} (${t.mode}): ${fighterDetails || "Empty"}`);
        });
        resultText = lines.join("\n");
    } else if (format === 'names') {
        const lines = ["# 🛡️ Custom Teams - Fighters List\n"];
        targetTeams.forEach(t => {
            const namesList = t.fighters.filter(Boolean).map(fName => {
                const info = getFighterDetails(fName);
                return info.name;
            }).join(", ");
            lines.push(`• ${t.name} (${t.mode}): ${namesList || "Empty"}`);
        });
        resultText = lines.join("\n");
    }

    navigator.clipboard.writeText(resultText).then(() => {
        alert(`Successfully copied ${targetTeams.length} team(s) to clipboard!`);
        closeExportTeamsModal();
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

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
    closeFighterModalDirect();
    closeTeamEditorModal();
    closeBackupModal();
    closeExportModal();
    closeExportTeamsModal();
    closeMobileFilterDrawer();
    const tfPicker = document.getElementById('teamFighterPicker');
    if (tfPicker) {
        tfPicker.classList.remove('show');
        tfPicker.style.display = 'none';
    }

    document.getElementById('wishlistModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderWishlistSlots();

    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
    const mobTab = document.getElementById('mobTabWishlist');
    if (mobTab) mobTab.classList.add('active');
}

function closeWishlistModal() {
    document.getElementById('wishlistModal').style.display = 'none';
    closeWishlistPicker();
    document.body.style.overflow = '';
}

function closeWishlistPicker() {
    const picker = document.getElementById('wishlistPicker');
    if (picker) {
        picker.classList.remove('show');
        picker.style.display = 'none';
    }
    if (document.activeElement) document.activeElement.blur();
}

function closeTeamFighterPicker() {
    const picker = document.getElementById('teamFighterPicker');
    if (picker) {
        picker.classList.remove('show');
        picker.style.display = 'none';
    }
    if (document.activeElement) document.activeElement.blur();
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
    
    if (left + 330 > window.innerWidth) left = window.innerWidth - 340;
    if (left < 10) left = 10;
    if (top + 340 > window.innerHeight) top = rect.top - 330;
    if (top < 10) top = 10;

    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
    picker.classList.add('show');
    picker.style.display = 'block';
    
    const searchInput = document.getElementById('wishlistSearch');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 50);
    }
    filterWishlistPicker();
}

function filterWishlistPicker() {
    const query = document.getElementById('wishlistSearch').value.toLowerCase().trim();
    const results = document.getElementById('wishlistPickerResults');
    results.innerHTML = '';
    
    if (!activePickerTier) return;

    const cards = Array.from(document.querySelectorAll('.card'));
    let matches = cards.filter(c => {
        const t = (c.dataset.tier || '').toLowerCase();
        const searchTxt = (c.dataset.search || '').toLowerCase();
        const rawName = (c.dataset.rawname || '').toLowerCase();
        
        const tierMatch = t === activePickerTier.toLowerCase();
        const searchMatch = !query || searchTxt.includes(query) || rawName.includes(query);
        return tierMatch && searchMatch;
    });
    
    // Sort matches: highest tier list ranks first, then alphabetical
    matches.sort((a, b) => {
        const pfoffA = RANK_VALUES[(a.dataset.pfoff || 'U').trim()] || 0;
        const pfoffB = RANK_VALUES[(b.dataset.pfoff || 'U').trim()] || 0;
        const riftoffA = RANK_VALUES[(a.dataset.riftoff || 'U').trim()] || 0;
        const riftoffB = RANK_VALUES[(b.dataset.riftoff || 'U').trim()] || 0;
        
        const scoreA = Math.max(pfoffA, riftoffA);
        const scoreB = Math.max(pfoffB, riftoffB);
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        const nameA = a.dataset.rawname || '';
        const nameB = b.dataset.rawname || '';
        return nameA.localeCompare(nameB);
    });

    if (matches.length === 0) {
        results.innerHTML = '<div style="color: #8b949e; text-align: center; padding: 12px; font-size: 0.85rem;">No matching fighters found</div>';
        return;
    }

    const currentList = activePickerTier === 'Gold' ? wishlistGolds : wishlistDiamonds;

    matches.forEach(c => {
        const name = c.dataset.rawname;
        const charName = c.dataset.char || 'Fighter';
        const isUnlocked = c.dataset.unlocked === 'true';
        const imgEl = c.querySelector('img');
        const img = imgEl ? imgEl.src : '';
        
        const pf = (c.dataset.pfoff || 'U').trim();
        const roff = (c.dataset.riftoff || 'U').trim();
        const rdef = (c.dataset.riftdef || 'U').trim();
        const realms = (c.dataset.realms || 'U').trim();

        const isAlreadyInWishlist = currentList.includes(name);

        let statusBadge = '';
        if (isAlreadyInWishlist) {
            statusBadge = '<span class="picker-badge-locked" style="color: #ffd700; border-color: #ffd700aa; background: #ffd70015;">⭐ In Wishlist</span>';
        } else if (isUnlocked) {
            statusBadge = '<span class="picker-badge-unlocked">Unlocked</span>';
        } else {
            statusBadge = '<span class="picker-badge-locked">🔒 Locked</span>';
        }

        const inspectBtn = document.createElement('button');
        inspectBtn.type = 'button';
        inspectBtn.title = 'Inspect Fighter Details';
        inspectBtn.innerHTML = '🔍';
        inspectBtn.style.cssText = 'background: rgba(88, 166, 255, 0.18); border: 1px solid #388bfd88; color: #58a6ff; border-radius: 6px; font-size: 0.85rem; padding: 4px 8px; cursor: pointer; flex-shrink: 0; margin: 0 4px; z-index: 5;';
        inspectBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            openFighterModalByName(name, e);
        };

        const div = document.createElement('div');
        div.className = `picker-item ${!isUnlocked ? 'locked-item' : ''}`;
        div.innerHTML = `
            ${img ? `<img src="${img}" style="${!isUnlocked ? 'filter: grayscale(35%);' : ''}">` : ''} 
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; color: #fff;">${name}</span>
                    <span style="font-size: 0.75rem; color: #8b949e;">(${charName})</span>
                </div>
                <div style="display: flex; gap: 3px; align-items: center; flex-wrap: wrap; margin-top: 1px;">
                    <span class="rank-badge rank-${pf}" title="PF Offense: ${pf}">PF: ${pf}</span>
                    <span class="rank-badge rank-${roff}" title="Rift Offense: ${roff}">R-Off: ${roff}</span>
                    <span class="rank-badge rank-${rdef}" title="Rift Defense: ${rdef}">R-Def: ${rdef}</span>
                    <span class="rank-badge rank-${realms}" title="Parallel Realms: ${realms}">Realms: ${realms}</span>
                </div>
            </div>
        `;
        div.appendChild(inspectBtn);
        const statusSpan = document.createElement('span');
        statusSpan.innerHTML = statusBadge;
        if (statusSpan.firstChild) div.appendChild(statusSpan.firstChild);

        div.onclick = (e) => {
            if (e.target.closest('button')) return;
            e.stopPropagation();
            if (activePickerTier === 'Gold') wishlistGolds[activePickerIndex] = name;
            if (activePickerTier === 'Diamond') wishlistDiamonds[activePickerIndex] = name;
            
            closeWishlistPicker();
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
    localStorage.setItem('sgm_wishlist', JSON.stringify({ golds: wishlistGolds, diamonds: wishlistDiamonds }));
    renderWishlistSlots();

    fetch('/update_wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ golds: wishlistGolds, diamonds: wishlistDiamonds })
    }).catch(() => {});
}

// Close picker when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.closest('#fighterModal') || e.target.closest('.fighter-modal-overlay')) {
        return;
    }
    const wlPicker = document.getElementById('wishlistPicker');
    if (wlPicker && (wlPicker.classList.contains('show') || wlPicker.style.display === 'block' || wlPicker.style.display === 'flex') && !e.target.closest('.wishlist-slot') && !e.target.closest('#wishlistPicker')) {
        wlPicker.classList.remove('show');
        wlPicker.style.display = 'none';
    }
    const tfPicker = document.getElementById('teamFighterPicker');
    if (tfPicker && (tfPicker.classList.contains('show') || tfPicker.style.display === 'block' || tfPicker.style.display === 'flex') && !e.target.closest('.team-slot-builder') && !e.target.closest('#teamFighterPicker')) {
        tfPicker.classList.remove('show');
        tfPicker.style.display = 'none';
    }
});

/* =========================================
   Main View Switcher & Mobile Drawer
   ========================================= */
function closeAllModals() {
    closeFighterModalDirect();
    closeWishlistModal();
    closeTeamEditorModal();
    closeBackupModal();
    closeExportModal();
    closeExportTeamsModal();
    closeMobileFilterDrawer();
    
    const tfPicker = document.getElementById('teamFighterPicker');
    if (tfPicker) {
        tfPicker.classList.remove('show');
        tfPicker.style.display = 'none';
    }
    const wlPicker = document.getElementById('wishlistPicker');
    if (wlPicker) {
        wlPicker.classList.remove('show');
        wlPicker.style.display = 'none';
    }
}

function switchView(viewName) {
    closeAllModals();

    document.querySelectorAll('.view-panel').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
    
    const filterBtn = document.getElementById('mobileFilterBtn');
    const wishBtn = document.getElementById('mobileWishlistBtn');
    const mobUnlockEl = document.getElementById('mobileUnlockCount');

    if (viewName === 'roster') {
        const roster = document.getElementById('rosterView');
        if (roster) {
            roster.classList.add('active');
            roster.style.display = 'block';
        }
        const tabRoster = document.getElementById('tabRoster');
        if (tabRoster) tabRoster.classList.add('active');
        const mobTabRoster = document.getElementById('mobTabRoster');
        if (mobTabRoster) mobTabRoster.classList.add('active');

        if (filterBtn) filterBtn.style.display = 'flex';
        if (wishBtn) wishBtn.style.display = 'inline-block';
        if (mobUnlockEl) mobUnlockEl.style.display = 'inline-block';
    } else if (viewName === 'teams') {
        const teams = document.getElementById('teamsView');
        if (teams) {
            teams.classList.add('active');
            teams.style.display = 'block';
        }
        const tabTeams = document.getElementById('tabTeams');
        if (tabTeams) tabTeams.classList.add('active');
        const mobTabTeams = document.getElementById('mobTabTeams');
        if (mobTabTeams) mobTabTeams.classList.add('active');

        if (filterBtn) filterBtn.style.display = 'none';
        if (wishBtn) wishBtn.style.display = 'none';
        if (mobUnlockEl) mobUnlockEl.style.display = 'none';
        renderTeams();
    }
    closeMobileFilterDrawer();
}

function toggleMobileFilterDrawer() {
    const container = document.getElementById('headerContainer');
    const overlay = document.getElementById('mobileFilterOverlay');
    if (container && overlay) {
        const isShown = container.classList.contains('show');
        if (isShown) {
            closeMobileFilterDrawer();
        } else {
            container.classList.add('show');
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
}

function closeMobileFilterDrawer() {
    const container = document.getElementById('headerContainer');
    const overlay = document.getElementById('mobileFilterOverlay');
    if (container && overlay) {
        container.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/* =========================================
   Team Builder Controller
   ========================================= */
let editingTeamId = null;
let draftTeamFighters = [null, null, null];
let activeTeamPickerSlot = null;

function getModeAttrKey(modeName) {
    if (modeName === 'Prize Fight') return 'pfoff';
    if (modeName === 'Rift Offense') return 'riftoff';
    if (modeName === 'Rift Defense') return 'riftdef';
    if (modeName === 'Parallel Realms') return 'realms';
    return 'pfoff';
}

function getModeShortLabel(modeName) {
    if (modeName === 'Prize Fight') return 'PF';
    if (modeName === 'Rift Offense') return 'Rift Off';
    if (modeName === 'Rift Defense') return 'Rift Def';
    if (modeName === 'Parallel Realms') return 'Realms';
    return 'PF';
}

function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    const modeFilter = document.getElementById('teamModeFilter') ? document.getElementById('teamModeFilter').value : '';
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const filteredTeams = teamsState.filter(t => !modeFilter || t.mode === modeFilter);
    const countEl = document.getElementById('teamCount');
    if (countEl) countEl.innerText = filteredTeams.length;
    
    if (filteredTeams.length === 0) {
        grid.innerHTML = `<div style="background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 40px; text-align: center; color: #8b949e;">
            <p style="font-size: 1.1rem; margin-bottom: 8px;">No team loadouts found</p>
            <p style="font-size: 0.9rem; margin: 0;">Click <strong>Create Team</strong> to build your first 3-fighter loadout and analyze synergies.</p>
        </div>`;
        return;
    }
    
    const allCards = Array.from(document.querySelectorAll('.card'));
    
    filteredTeams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-card';
        const teamMode = team.mode || 'Prize Fight';
        const modeAttr = getModeAttrKey(teamMode);
        
        let fightersHtml = '';
        let teamFighterElements = [];
        
        for (let i = 0; i < 3; i++) {
            const fighterName = team.fighters ? team.fighters[i] : null;
            if (fighterName) {
                const cardEl = allCards.find(c => c.dataset.rawname === fighterName);
                if (cardEl) {
                    teamFighterElements.push(cardEl);
                    const imgEl = cardEl.querySelector('img');
                    const img = imgEl ? imgEl.src : '';
                    const char = cardEl.dataset.char || '';
                    const tier = cardEl.dataset.tier || '';
                    const elem = cardEl.dataset.element || '';
                    const isUnlocked = cardEl.dataset.unlocked === 'true';
                    const rank = (cardEl.dataset[modeAttr] || 'U').trim();
                    
                    fightersHtml += `
                        <div class="team-fighter-slot clickable" onclick="openFighterModalByName('${fighterName.replace(/'/g, "\\'")}', event)" title="Click to inspect fighter kit & stats" style="cursor: pointer; ${isUnlocked ? '' : 'opacity: 0.85;'}">
                            ${img ? `<img src="${img}" style="${isUnlocked ? '' : 'filter: grayscale(35%);'}">` : ''}
                            <div class="team-fighter-info" style="flex: 1;">
                                <div class="team-fighter-name" style="display:flex; align-items:center; gap:6px;">
                                    <span>${fighterName}</span>
                                    <span class="rank-badge rank-${rank}" title="${teamMode} Rank">${rank}</span>
                                    ${isUnlocked ? '' : '<span style="font-size:0.75rem; color:#8b949e; border:1px solid #30363d; border-radius:3px; padding:0 3px;">🔒 Locked</span>'}
                                </div>
                                <div class="team-fighter-meta" style="display:flex; align-items:center; justify-content:space-between;">
                                    <span>${char} • ${tier} • ${elem}</span>
                                    <span style="font-size: 0.75rem; color: #58a6ff; font-weight: 500; margin-left: auto;">Inspect 🔍</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    fightersHtml += `
                        <div class="team-fighter-slot clickable" onclick="openFighterModalByName('${fighterName.replace(/'/g, "\\'")}', event)" title="Click to inspect fighter" style="cursor: pointer;">
                            <div class="team-fighter-info" style="flex:1;">
                                <div class="team-fighter-name" style="display:flex; align-items:center; justify-content:space-between;">
                                    <span>${fighterName}</span>
                                    <span style="font-size: 0.75rem; color: #58a6ff; font-weight: 500;">Inspect 🔍</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                fightersHtml += `
                    <div class="team-fighter-slot" style="opacity: 0.5;">
                        <div class="team-fighter-info">
                            <div class="team-fighter-name" style="color: #8b949e;">Fighter ${i+1} Empty</div>
                        </div>
                    </div>
                `;
            }
        }
        
        // Generate combined synergy items
        const synergyHtml = generateSynergyHtml(teamFighterElements, teamMode);
        
        card.innerHTML = `
            <div class="team-header-row">
                <div class="team-title-group">
                    <span class="team-name">${team.name}</span>
                    <span class="team-mode-badge">${teamMode}</span>
                </div>
                <div class="team-actions">
                    <button class="btn-secondary" onclick="openEditTeamModal('${team.id}')" style="padding: 5px 10px; font-size: 0.8rem;">Edit</button>
                    <button class="btn-secondary" onclick="deleteTeam('${team.id}')" style="padding: 5px 10px; font-size: 0.8rem; color: #ff7b72; border-color: #ff444444;">Delete</button>
                </div>
            </div>
            <div class="team-fighters-grid">
                ${fightersHtml}
            </div>
            <div class="synergy-panel">
                <h4>Combined Synergies & Signature Abilities</h4>
                ${synergyHtml}
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function generateSynergyHtml(fighterCardElements, teamMode) {
    if (!fighterCardElements || fighterCardElements.length === 0) {
        return `<p style="color: #8b949e; font-size: 0.85rem; margin: 0;">No fighters selected for this team.</p>`;
    }
    
    const modeAttr = getModeAttrKey(teamMode || 'Prize Fight');
    let html = '';
    fighterCardElements.forEach(cardEl => {
        const name = cardEl.dataset.rawname;
        const isUnlocked = cardEl.dataset.unlocked === 'true';
        const rank = (cardEl.dataset[modeAttr] || 'U').trim();
        let dataFighter = {};
        try {
            dataFighter = JSON.parse(cardEl.dataset.fighter || '{}');
        } catch (e) {}
        
        const sa1 = dataFighter.sa1;
        const sa2 = dataFighter.sa2;
        
        if (sa1 || sa2) {
            html += `
                <div class="synergy-item">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <strong style="color: #7ee787; cursor: pointer;" onclick="openFighterModalByName('${name.replace(/'/g, "\\'")}', event)" title="Click to inspect fighter">${name} 🔍</strong>
                        <span class="rank-badge rank-${rank}" title="Rank: ${rank}">${rank}</span>
                        ${isUnlocked ? '' : '<span style="color:#8b949e; font-size:0.75rem; border:1px solid #30363d; border-radius:3px; padding:0 3px;">🔒 Locked</span>'}
                    </div>
                    ${sa1 ? `<div style="margin-top:2px;">• <em>SA1:</em> ${sa1}</div>` : ''}
                    ${sa2 ? `<div style="margin-top:2px;">• <em>SA2:</em> ${sa2}</div>` : ''}
                </div>
            `;
        }
    });
    
    return html || `<p style="color: #8b949e; font-size: 0.85rem; margin: 0;">No signature abilities available.</p>`;
}

function openCreateTeamModal() {
    editingTeamId = null;
    draftTeamFighters = [null, null, null];
    document.getElementById('teamEditorTitle').innerText = 'Create New Team';
    document.getElementById('teamNameInput').value = '';
    document.getElementById('teamModeSelect').value = 'Prize Fight';
    updateTeamSlotBuilders();
    updateSynergyPreview();
    document.getElementById('teamEditorModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function openEditTeamModal(teamId) {
    const team = teamsState.find(t => t.id === teamId);
    if (!team) return;
    
    editingTeamId = teamId;
    draftTeamFighters = team.fighters ? [...team.fighters] : [null, null, null];
    document.getElementById('teamEditorTitle').innerText = 'Edit Team Loadout';
    document.getElementById('teamNameInput').value = team.name || '';
    document.getElementById('teamModeSelect').value = team.mode || 'Prize Fight';
    updateTeamSlotBuilders();
    updateSynergyPreview();
    document.getElementById('teamEditorModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeTeamEditorModal() {
    document.getElementById('teamEditorModal').style.display = 'none';
    const tfPicker = document.getElementById('teamFighterPicker');
    if (tfPicker) {
        tfPicker.classList.remove('show');
        tfPicker.style.display = 'none';
    }
    document.body.style.overflow = '';
}

function updateTeamSlotBuilders() {
    const allCards = Array.from(document.querySelectorAll('.card'));
    const modalMode = document.getElementById('teamModeSelect') ? document.getElementById('teamModeSelect').value : 'Prize Fight';
    const modeAttr = getModeAttrKey(modalMode);
    
    for (let i = 0; i < 3; i++) {
        const slotEl = document.getElementById(`slotContent${i}`);
        const name = draftTeamFighters[i];
        if (name) {
            const cardEl = allCards.find(c => c.dataset.rawname === name);
            const imgEl = cardEl ? cardEl.querySelector('img') : null;
            const img = imgEl ? imgEl.src : '';
            const isUnlocked = cardEl ? cardEl.dataset.unlocked === 'true' : true;
            const rank = cardEl ? (cardEl.dataset[modeAttr] || 'U').trim() : 'U';
            
            slotEl.className = 'slot-content filled';
            slotEl.innerHTML = `
                ${img ? `<img src="${img}" style="${isUnlocked ? '' : 'filter: grayscale(35%);'} cursor: pointer;" onclick="openFighterModalByName('${name.replace(/'/g, "\\'")}', event)" title="Click to inspect fighter">` : ''}
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 2px;">
                    <div style="display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0;">
                        <span style="font-weight: 600; font-size: 0.9rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
                        <span class="rank-badge rank-${rank}" style="flex-shrink: 0;">${rank}</span>
                    </div>
                    ${isUnlocked ? '<span style="font-size: 0.7rem; color: #7ee787;">Unlocked</span>' : '<span style="font-size: 0.7rem; color: #8b949e;">🔒 Locked</span>'}
                </div>
                <button onclick="openFighterModalByName('${name.replace(/'/g, "\\'")}', event)" style="margin-left: auto; margin-right: 6px; background: rgba(88, 166, 255, 0.15); border: 1px solid #388bfd66; color: #58a6ff; font-size: 0.75rem; border-radius: 4px; padding: 3px 7px; cursor: pointer; flex-shrink: 0;" title="Inspect Fighter Kit & Stats">Inspect 🔍</button>
                <button onclick="clearTeamSlot(${i}, event)" style="background: none; border: none; color: #ff7b72; font-size: 1.2rem; cursor: pointer; padding: 2px 4px; flex-shrink: 0;" title="Remove Fighter">✕</button>
            `;
        } else {
            slotEl.className = 'slot-content empty';
            slotEl.innerHTML = '+ Pick Fighter';
        }
    }
}

function clearTeamSlot(slotIndex, event) {
    if (event) event.stopPropagation();
    draftTeamFighters[slotIndex] = null;
    updateTeamSlotBuilders();
    updateSynergyPreview();
}

function updateSynergyPreview() {
    const allCards = Array.from(document.querySelectorAll('.card'));
    const selectedCards = draftTeamFighters
        .filter(Boolean)
        .map(name => allCards.find(c => c.dataset.rawname === name))
        .filter(Boolean);
        
    const modalMode = document.getElementById('teamModeSelect') ? document.getElementById('teamModeSelect').value : 'Prize Fight';
    const container = document.getElementById('synergyPreview');
    container.innerHTML = generateSynergyHtml(selectedCards, modalMode);
}

function saveTeamFromModal() {
    const name = document.getElementById('teamNameInput').value.trim() || 'Untitled Team';
    const mode = document.getElementById('teamModeSelect').value;
    
    // Check for duplicate fighters in the draft team
    const selectedFighters = draftTeamFighters.filter(Boolean);
    const uniqueFighters = new Set(selectedFighters);
    if (selectedFighters.length !== uniqueFighters.size) {
        alert('A team loadout cannot contain duplicate fighters! Please select unique variants for each slot.');
        return;
    }
    
    if (editingTeamId) {
        const team = teamsState.find(t => t.id === editingTeamId);
        if (team) {
            team.name = name;
            team.mode = mode;
            team.fighters = [...draftTeamFighters];
        }
    } else {
        const newTeam = {
            id: 'team_' + Date.now(),
            name: name,
            mode: mode,
            fighters: [...draftTeamFighters]
        };
        teamsState.push(newTeam);
    }
    
    closeTeamEditorModal();
    saveTeamsToServer();
}

function deleteTeam(teamId) {
    if (confirm('Are you sure you want to delete this team loadout?')) {
        teamsState = teamsState.filter(t => t.id !== teamId);
        saveTeamsToServer();
    }
}

function saveTeamsToServer() {
    localStorage.setItem('sgm_custom_teams', JSON.stringify(teamsState));
    renderTeams();

    fetch('/update_teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: teamsState })
    }).catch(() => {});
}

function openTeamFighterPicker(slotIndex, event) {
    if (event) event.stopPropagation();
    activeTeamPickerSlot = slotIndex;
    const picker = document.getElementById('teamFighterPicker');
    
    if (window.innerWidth <= 900 || window.innerHeight <= 600) {
        picker.style.top = '';
        picker.style.left = '';
    } else {
        const rect = event.currentTarget.getBoundingClientRect();
        let top = rect.bottom + 8;
        let left = rect.left;
        
        if (left + 310 > window.innerWidth) left = window.innerWidth - 320;
        if (left < 10) left = 10;
        if (top + 320 > window.innerHeight) top = rect.top - 320;
        if (top < 10) top = 10;

        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
    }

    picker.classList.add('show');
    picker.style.display = 'flex';
    
    const searchInput = document.getElementById('teamFighterSearch');
    if (searchInput) {
        searchInput.value = '';
        filterTeamFighterPicker();
        setTimeout(() => searchInput.focus(), 80);
    }
}

function filterTeamFighterPicker() {
    const query = document.getElementById('teamFighterSearch').value.toLowerCase().trim();
    const unlockedOnly = document.getElementById('pickerUnlockedOnly') ? document.getElementById('pickerUnlockedOnly').checked : false;
    const modalMode = document.getElementById('teamModeSelect') ? document.getElementById('teamModeSelect').value : 'Prize Fight';
    
    const modeAttr = getModeAttrKey(modalMode);
    const modeLabel = getModeShortLabel(modalMode);
    
    const sortLabel = document.getElementById('pickerSortLabel');
    if (sortLabel) sortLabel.innerText = `Sorted by ${modeLabel} Rank`;
    
    const results = document.getElementById('teamFighterPickerResults');
    results.innerHTML = '';
    
    const cards = Array.from(document.querySelectorAll('.card'));
    let matches = cards.filter(c => {
        const searchTxt = (c.dataset.search || '').toLowerCase();
        const rawName = (c.dataset.rawname || '').toLowerCase();
        const isUnlocked = c.dataset.unlocked === 'true';
        
        if (unlockedOnly && !isUnlocked) return false;
        return !query || searchTxt.includes(query) || rawName.includes(query);
    });
    
    // Sort matches by tier list rank for the selected mode (SS -> S -> A -> B -> C -> U)
    matches.sort((a, b) => {
        const nameA = a.dataset.rawname;
        const nameB = b.dataset.rawname;
        
        // Put already selected fighters at the end
        const isSelA = draftTeamFighters.some((f, idx) => f === nameA && idx !== activeTeamPickerSlot);
        const isSelB = draftTeamFighters.some((f, idx) => f === nameB && idx !== activeTeamPickerSlot);
        if (isSelA !== isSelB) return isSelA ? 1 : -1;
        
        const rankA = (a.dataset[modeAttr] || 'U').trim();
        const rankB = (b.dataset[modeAttr] || 'U').trim();
        const valA = RANK_VALUES[rankA] || 0;
        const valB = RANK_VALUES[rankB] || 0;
        
        if (valA !== valB) return valB - valA;
        
        const unA = a.dataset.unlocked === 'true' ? 1 : 0;
        const unB = b.dataset.unlocked === 'true' ? 1 : 0;
        if (unA !== unB) return unB - unA;
        
        return (nameA || '').localeCompare(nameB || '');
    });
    
    if (matches.length === 0) {
        results.innerHTML = '<div style="color: #8b949e; text-align: center; padding: 12px; font-size: 0.85rem;">No matching fighters found</div>';
        return;
    }

    matches.forEach(c => {
        const name = c.dataset.rawname;
        const imgEl = c.querySelector('img');
        const img = imgEl ? imgEl.src : '';
        const tier = c.dataset.tier || '';
        const isUnlocked = c.dataset.unlocked === 'true';
        const rank = (c.dataset[modeAttr] || 'U').trim();
        
        const isAlreadyInTeam = draftTeamFighters.some((f, idx) => f === name && idx !== activeTeamPickerSlot);
        
        const div = document.createElement('div');
        div.className = `picker-item ${isAlreadyInTeam || !isUnlocked ? 'locked-item' : ''}`;
        if (isAlreadyInTeam) {
            div.style.cursor = 'not-allowed';
            div.style.opacity = '0.45';
        }
        
        let statusBadge = '';
        if (isAlreadyInTeam) {
            statusBadge = '<span class="picker-badge-locked" style="color: #ff7b72; border-color: #ff7b7266;">In Team</span>';
        } else if (isUnlocked) {
            statusBadge = '<span class="picker-badge-unlocked">Unlocked</span>';
        } else {
            statusBadge = '<span class="picker-badge-locked">🔒 Locked</span>';
        }
        
        const inspectBtn = document.createElement('button');
        inspectBtn.type = 'button';
        inspectBtn.title = 'Inspect Fighter Details';
        inspectBtn.innerHTML = '🔍 Inspect';
        inspectBtn.style.cssText = 'background: rgba(88, 166, 255, 0.18); border: 1px solid #388bfd88; color: #58a6ff; border-radius: 6px; font-size: 0.78rem; font-weight: 600; padding: 4px 8px; cursor: pointer; flex-shrink: 0; margin: 0 4px; z-index: 5;';
        inspectBtn.ontouchstart = (e) => {
            e.stopPropagation();
        };
        inspectBtn.ontouchend = (e) => {
            e.stopPropagation();
        };
        inspectBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            openFighterModalByName(name, e);
        };

        div.innerHTML = `
            ${img ? `<img src="${img}" style="${!isUnlocked || isAlreadyInTeam ? 'filter: grayscale(40%);' : ''}">` : ''} 
            <div style="flex:1; display:flex; flex-direction:column; gap:1px; overflow:hidden;">
                <div style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                    <span>${name}</span>
                    <span style="font-size:0.75rem; color:#8b949e; font-weight:400;">(${tier})</span>
                </div>
            </div>
            <span class="rank-badge rank-${rank}" title="${modeLabel} Rank: ${rank}">${rank}</span>
        `;
        div.appendChild(inspectBtn);
        const statusSpan = document.createElement('span');
        statusSpan.innerHTML = statusBadge;
        if (statusSpan.firstChild) div.appendChild(statusSpan.firstChild);
        
        div.onclick = (e) => {
            if (e.target.closest('button')) return;
            e.stopPropagation();
            if (isAlreadyInTeam) return;
            draftTeamFighters[activeTeamPickerSlot] = name;
            closeTeamFighterPicker();
            updateTeamSlotBuilders();
            updateSynergyPreview();
        };
        results.appendChild(div);
    });
}



/**
 * Open Backup & Restore Modal.
 */
function openBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('show');
}

/**
 * Close Backup & Restore Modal.
 */
function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.remove('show');
}

/**
 * Export full user data (Roster, Wishlist, Custom Teams) as downloadable JSON backup.
 */
function exportFullBackup() {
    const unlocked = [];
    document.querySelectorAll('.card[data-unlocked="true"]').forEach(c => {
        if (c.dataset.rawname) unlocked.push(c.dataset.rawname);
    });

    const backupData = {
        version: "4.0",
        exportDate: new Date().toISOString(),
        unlockedRoster: unlocked,
        wishlist: {
            golds: wishlistGolds,
            diamonds: wishlistDiamonds
        },
        teams: teamsState
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sgm_tracker_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/**
 * Import full user data from uploaded JSON backup file.
 * @param {Event} event - File input change event.
 */
function importFullBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 1. Restore Roster Unlocked State
            if (Array.isArray(data.unlockedRoster)) {
                const unlockedSet = new Set(data.unlockedRoster);
                document.querySelectorAll('.card').forEach(card => {
                    const name = card.dataset.rawname;
                    const isUnlocked = unlockedSet.has(name);
                    setCardState(name, isUnlocked);
                });
                syncRosterToLocalStorage();
                updateCount();

                // Send to backend if connected
                fetch('/apply_states', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        states: Array.from(document.querySelectorAll('.card')).map(c => ({
                            name: c.dataset.rawname,
                            previousState: c.dataset.unlocked === 'true'
                        }))
                    })
                }).catch(() => {});
            }

            // 2. Restore Wishlist State
            if (data.wishlist) {
                wishlistGolds = Array.isArray(data.wishlist.golds) ? data.wishlist.golds : [];
                wishlistDiamonds = Array.isArray(data.wishlist.diamonds) ? data.wishlist.diamonds : [];
                saveWishlist();
            }

            // 3. Restore Teams State
            if (Array.isArray(data.teams)) {
                teamsState = data.teams;
                saveTeamsToServer();
            }

            alert('Backup data successfully imported and restored!');
            closeBackupModal();
            filterAndSortCards();
        } catch (err) {
            alert('Error parsing backup file. Please ensure it is a valid JSON backup file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
