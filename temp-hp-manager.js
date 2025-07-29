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

    pf1.chat.enrichers.enrichers.push(...enricherConfig);
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
 * Overrides an amount of temp hp in a source to be the new passed value
 * If adding and the source is not found, a new source is created
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 */
async function overrideSource(actor, value, source) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    inUse = true;
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let foundSource = tempHpArray.find(o => o.source === source);
    if (!foundSource) addTemp(actor, value, source);
    else {
        await actor.addTempHP(value - foundSource.value);
        foundSource.value = value;
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

/**
 * Configures the enrichers, defining the regex, what handles the button creation, and what handles when clicked
 */
const enricherConfig = [
    {
        pattern: /@AddTemp\[(?<value>(?:[^[\]]|\[[^[\]]*])*?)(?:\|(?<options>.*?))?\](?:\{(?<label>.*?)})?/g,
        enricher: addTempEnricher,
        replaceParent: false,
        id: 'addTemp',
        click: addTempFromEnricher
    },
    {
        pattern: /@RemoveTemp\[(?<source>.*?)?\](?:\{(?<label>.*?)})?/g,
        enricher: removeTempEnricher,
        replaceParent: false,
        id: 'removeTemp',
        click: removeTempFromEnricher
    }
]

/**
 * Adds temporary HP to all selected tokens in the way defined by the button
 * 
 * @param {Event} event the trigger
 */
async function addTempFromEnricher(event) {
    const target = event.target;
    const messageId = target.closest("[data-message-id]")?.dataset.messageId;
    const message = game.messages.get(messageId);
    let rollData;
    if (message) rollData = getMessageRollData(message);
    else {
        const itemId = getItemFromSheet(target);
        const targetDocument = !!itemId ? getSheet(target)?.document?.items?.get(itemId) : getSheet(target)?.document;
        rollData = targetDocument?.getRollData() ?? {};
    }

    for (const token of canvas.tokens.controlled) {
        const roll = await pf1.dice.RollPF.safeRoll(target.dataset.formula, target.dataset.rolldata === 'selected' ? token.actor.getRollData() : rollData);
        const source = target.dataset.source;
        if (!!source) {
            if (!!target.dataset.override) overrideSource(token.actor, roll.total, source);
            else addToSource(token.actor, roll.total, source);
        }
        else {
            addTemp(token.actor, roll.total);
        }
    }
}

/**
 * Removes a source of temp HP from all selected tokens
 * 
 * @param {Event} event the trigger
 */
async function removeTempFromEnricher(event) {
    const target = event.target;
    
    for (const token of canvas.tokens.controlled) {
        removeSource(token.actor, target.dataset.source);
    }
}

/**
 * Creates a button for the enricher.
 * 
 * @param {object} data 
 * @returns {HTMLElement}
 */
async function addTempEnricher(data) {
    const { value, options, label } = data.groups;
    
    const optionTokens = options?.split('|') ?? [];
    const optionObject = {};
    for (const token of optionTokens) {
        const index = token.indexOf(':');
        if (index < 0) continue;
        else optionObject[token.trim().slice(0, index)] = token.trim().slice(index + 1);
    }

    const button = document.createElement('a');
    button.classList.add('pf1-link', 'button');
    button.dataset.handler = 'addTemp';
    button.innerHTML = '<i class="far fa-heart"></i> ' + (!!label ? 'Temp ' + label : 'Add Temp HP ' + value);
    button.dataset.formula = value;
    let override = optionTokens.includes('override');
    if (!!optionObject.source) button.dataset.source = optionObject.source;
    if (!!optionObject.rolldata) button.dataset.rolldata = optionObject.rolldata;
    if (override) button.dataset.override = "override";
    button.dataset.tooltip = 'Add Temp: ' + value + (optionObject.source ? (override ? '<br>Overriding ' : '<br>As ') + optionObject.source : '');
    return button;
}

/**
 * Creates a button for the enricher.
 * 
 * @param {object} data 
 * @returns {HTMLElement}
 */
async function removeTempEnricher(data) {
    const { source, label } = data.groups;
    
    const button = document.createElement('a');
    button.classList.add('pf1-link', 'button');
    button.dataset.handler = 'removeTemp';
    button.innerHTML = '<i class="far fa-heart"></i> ' + (!!label ? 'Temp ' + label : 'Remove Source ' + source);
    button.dataset.source = source;

    return button;
}

/**
 * Compiles roll data from the passed message if available
 * 
 * @param {ChatMessage} message
 * @returns 
 */
function getMessageRollData(message) {
    let dataSource = message.actionSource ?? message.itemSource;
    if (!dataSource && !!message.speaker) dataSource = ChatMessage.implementation.getSpeakerActor(message.speaker);
    const rollData = dataSource?.getRollData() ?? {};

    if (message.system?.config) {
        const config = message.system.config;
        if (!!config.cl) rollData.cl = config.cl;
        if (!!config.sl) rollData.sl = config.sl;
        if (!!config.critMult) rollData.critMult = config.critMult;
    }

    return rollData;
}

/**
 * Gets the sheet the button is on
 * 
 * @param {Event} eventTarget The trigger
 * @returns {Application} Foundry app
 */
function getSheet(eventTarget) {
    const element = eventTarget.closest(".app[data-appid],.application");
    let application;

    if (!!element.id && !!foundry.applications.instances.get(element.id)) application = foundry.applications.instances.get(element.id);
    else if (!!element.dataset.appId) application = ui.windows[element.dataset.appId];
    else if (!!element.dataset.appid) application = ui.windows[element.dataset.appid];
    return application;
}

/**
 * Gets the id of item the button is on on the sheet
 * 
 * @param {Event} eventTarget The trigger
 * @returns {Application} Foundry app
 */
function getItemFromSheet(eventTarget) {
    const element = eventTarget.closest('li.item[data-item-id');

    return element?.dataset.itemId;
}