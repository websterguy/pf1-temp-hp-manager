let inUse = false;

/**
 * Monitor preUpdateActor for changes to temp hp to add to manager
 * Prevents temp hp from going below 0 
 */
Hooks.on('preUpdateActor', async (actor, update, change) => {
    if (inUse) return inUse = false;
    let value = change.pf1?.deltas?.hp?.temp;
    if (!value) return;
    value = Number(value);
    
    if (Number.isNaN(value)) return await actor.unsetFlag('pf1-temp-hp-manager', 'tempHp');

    if (-value > actor.system.attributes.hp.temp) {
        update.system.attributes.hp.temp = 0;
        value = -actor.system.attributes.hp.temp;
    }
    
    if (value > 0) {
        addSource(actor, value);
    }
    else {
        removeTemp(actor, value);
    }
});

/**
 * Expose functions in game.tempHpManager
 */
Hooks.once('init', () => {
    game.tempHpManager = game.tempHpManager || {};

    game.tempHpManager.addTemp = addTemp;
    game.tempHpManager.removeSource = removeSource;
    game.tempHpManager.addToSource = addToSource;
})

/**
 * Adds temp hp to the manager
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 */
async function addTemp(actor, value, source = null) {
    inUse = true;
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    await actor.addTempHP(value);
    if (Number(value) > 0) {
        addSource(actor, value, source);
    }
    else {
        removeTemp(actor, value);
    }
    inUse = false;
}

/**
 * Adds a temp source to the tracker
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 */
async function addSource(actor, value, source) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    tempHpArray.push({value: value, source: source});
    await actor.setFlag('pf1-temp-hp-manager', 'tempHp', tempHpArray);
}

/**
 * Removes an amount of temp hp from the tracker, first source added is first source removed
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to remove from temp hp (as a negative number)
 */
async function removeTemp(actor, value) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    while (value < 0) {
        let firstAmount = tempHpArray[0]?.value;
        value += firstAmount;
        if (value <= 0) {
            tempHpArray.splice(0, 1);
        }
        else {
            tempHpArray[0].value = value;
        }
    }
    actor.setFlag('pf1-temp-hp-manager', 'tempHp', tempHpArray);
}

/**
 * Finds a specific source by name in the manager, removes it, and removes the temp hp from the actor
 * 
 * @param {actor} actor PC or NPC actor
 * @param {*} source The name of the source to remove from the manager
 * @returns 
 */
async function removeSource(actor, source) {
    inUse = true;
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let removed = tempHpArray.findSplice(o => o.source === source);
    if (!removed) return console.warn(`Temp HP source "${source}" not found to be removed`);
    await actor.addTempHP(-removed.value);
    await actor.setFlag('pf1-temp-hp-manager', 'tempHp', tempHpArray);
    inUse = false;
}

/**
 * Adds an amount of temp hp to a source (negative number subtracts from it)
 * If adding and the source is not found, a new source is created
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 */
async function addToSource(actor, value, source) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    inUse = true;
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let foundSource = tempHpArray.find(o => o.source === source);
    if (!foundSource) addTemp(actor, value, source);
    else {
        await actor.addTempHP(value);
        foundSource.value += value;
        await actor.setFlag('pf1-temp-hp-manager', 'tempHp', tempHpArray);
    }
}

/**
 * Adds temp hp sources to the HP tooltip
 */
Hooks.on('renderPF1ExtendedTooltip', (sheet, identifier, template) => {
    if (identifier === 'hit-points') {
        let tempHpArray = sheet.actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
        if (tempHpArray.length === 0) return;
        const section = document.createElement('h4');
        section.innerHTML = 'Temp HP Sources';
        template.content.append(section);
        for (const tempSource of tempHpArray) {
            const flavor = document.createElement('span');
            const value = document.createElement('span');
            flavor.classList.add('flavor');
            value.classList.add('value', 'untyped');
            flavor.innerHTML = tempSource.source ?? 'Unsourced';
            value.innerHTML = tempSource.value;
            template.content.append(flavor);
            template.content.append(value);
        }
    }
})