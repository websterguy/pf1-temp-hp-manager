/**
 * Monitor preUpdateActor for changes to temp hp to add to manager
 * Prevents temp hp from going below 0 
 */
Hooks.on('preUpdateActor', async (actor, update, change) => {
    const vigor = getVigorSetting(actor);
    let value = !vigor ? change.pf1?.deltas?.hp?.temp : change.pf1?.deltas?.vigor?.temp;
    if (!value) return;
    const flagBeingSet = update.flags;
    if (flagBeingSet && !!flagBeingSet['pf1-temp-hp-manager']) return;
    value = Number(value);
    if (Number.isNaN(value)) update.flags['pf1-temp-hp-manager'].tempHp = [];
    else {
        let curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;

        if (-value > curTHP) {
            update.system.attributes[vigor ? 'vigor' : 'hp'].temp = 0;
            value = -curTHP;
        }
        
        const updateData = addTemp(actor, value, null, true);
        update.flags = update.flags ?? {};
        update.flags['pf1-temp-hp-manager'] = updateData.flags['pf1-temp-hp-manager'];
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
    game.tempHpManager.overrideSource = overrideSource;

    pf1.chat.enrichers.enrichers.push(...enricherConfig);
    libWrapper.register("pf1-temp-hp-manager", 'pf1.documents.actor.ActorPF.prototype.addTempHP', addTempHPWrapper, 'OVERRIDE');
})

async function addTempHPWrapper(value, { set = false } = {}) {
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    const vigor = getVigorSetting(this);

    if (set) {
        const curTHP = (vigor ? this.system.attributes.vigor.temp : this.system.attributes.hp.temp) || 0;
        value -= curTHP;
    }

    addTemp(this, value);
}

/**
 * Adds temp hp to the manager
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function addTemp(actor, value, source = null, giveReturn = false) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    if (Number(value) > 0) {
        return addSource(actor, value, source, giveReturn);
    }
    else {
        return removeTemp(actor, value, giveReturn);
    }
}

/**
 * Adds a temp source to the tracker
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function addSource(actor, value, source, giveReturn = false) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    tempHpArray.push({value: value, source: source});
    const vigor = getVigorSetting(actor);
    const curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;
    const update = { flags: { ['pf1-temp-hp-manager']: { tempHp: tempHpArray } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: curTHP + value } } } };

    if (giveReturn) return update;
    actor.update(update);
}

/**
 * Removes an amount of temp hp from the tracker, first source added is first source removed
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to remove from temp hp (as a negative number)
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function removeTemp(actor, value, giveReturn = false) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');

    const vigor = getVigorSetting(actor);
    const curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;
    const newTHP = Math.max(curTHP + value, 0);

    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let update;
    if (newTHP === 0) {
        update = { flags: { ['pf1-temp-hp-manager']: { tempHp: [] } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: newTHP } } } };
    }
    else {
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
        update = { flags: { ['pf1-temp-hp-manager']: { tempHp: tempHpArray } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: newTHP } } } };
    }
    
    if (giveReturn) return update;
    actor.update(update);
}

/**
 * Finds a specific source by name in the manager, removes it, and removes the temp hp from the actor
 * 
 * @param {actor} actor PC or NPC actor
 * @param {string} source The name of the source to remove from the manager
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function removeSource(actor, source, giveReturn = false) {
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let removed = tempHpArray.findSplice(o => o.source === source);
    if (!removed) return {};
    const vigor = getVigorSetting(actor);
    const curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;
    const update = { flags: { ['pf1-temp-hp-manager']: { tempHp: tempHpArray } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: curTHP - removed.value } } } };

    if (giveReturn) return update;
    actor.update(update);
}

/**
 * Adds an amount of temp hp to a source (negative number subtracts from it)
 * If adding and the source is not found, a new source is created
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function addToSource(actor, value, source, giveReturn = false) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let foundSource = tempHpArray.find(o => o.source === source);
    
    const vigor = getVigorSetting(actor);
    const curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;
    
    if (!foundSource) {
        if (value > 0) return addTemp(actor, value, source, giveReturn);
    }
    else {
        if (value < 0 && (-value) >= foundSource.value) {
            value = -foundSource.value;
            tempHpArray.findSplice(o => o.source === source);
        }

        foundSource.value += value;
        const update = { flags: { ['pf1-temp-hp-manager']: { tempHp: tempHpArray } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: curTHP + value } } } }

        if (giveReturn) return update;
        actor.update(update);
    }
}

/**
 * Overrides an amount of temp hp in a source to be the new passed value
 * If adding and the source is not found, a new source is created
 * 
 * @param {actor} actor PC or NPC actor
 * @param {number} value Value to add to temp hp (negative number subtracts)
 * @param {string} source Name of the source of temp hp for tracking and display
 * @param {boolean} giveReturn True means that the calling function expects to get return of the data for an update instead of running the update
 * @returns {object} The data to be passed into an actor update
 */
function overrideSource(actor, value, source, giveReturn = false) {
    value = Number(value);
    if (Number.isNaN(value)) return console.warn('Tried to add a non-number to temp hp');
    let tempHpArray = actor.getFlag('pf1-temp-hp-manager', 'tempHp') ?? [];
    let foundSource = tempHpArray.find(o => o.source === source);
    if (!foundSource) return addTemp(actor, value, source, giveReturn);
    else {
        if (value <= 0) return removeSource(actor, source, giveReturn);
        else {
            const vigor = getVigorSetting(actor);
            const curTHP = (vigor ? actor.system.attributes.vigor.temp : actor.system.attributes.hp.temp) || 0;
            const newTHP = curTHP + value - foundSource.value;
            foundSource.value = value;
            const update = { flags: { ['pf1-temp-hp-manager']: { tempHp: tempHpArray } }, system: { attributes: { [vigor ? "vigor" : "hp"]: { temp: newTHP } } } };

            if (giveReturn) return update;
            actor.update(update);
        }
    }
}

/**
 * Adds temp hp sources to the HP tooltip
 */
Hooks.on('renderPF1ExtendedTooltip', (sheet, identifier, template) => {
    if (identifier === 'hit-points' || identifier === 'vigor') {
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

    const updates = [];

    for (const token of canvas.tokens.controlled) {
        let update;
        const roll = await pf1.dice.RollPF.safeRoll(target.dataset.formula, target.dataset.rolldata === 'selected' ? token.actor.getRollData() : rollData);
        const source = target.dataset.source;

        if (!!source) {
            if (!!target.dataset.override) {

                update = overrideSource(token.actor, roll.total, source, true);
            }
            else {
                update = addToSource(token.actor, roll.total, source, true);
            }
        }
        else {
            update = addTemp(token.actor, roll.total, null, true);
        }

        if (!update) continue;
        if (token.document.isLinked) {
            update._id = token.actor.id;
            updates.push(update);
        }
        else token.actor.update(update);
    }
    Actor.implementation.updateDocuments(updates);
}

/**
 * Removes a source of temp HP from all selected tokens
 * 
 * @param {Event} event the trigger
 */
async function removeTempFromEnricher(event) {
    const target = event.target;

    const updates = [];
    
    for (const token of canvas.tokens.controlled) {
        const update = removeSource(token.actor, target.dataset.source, true);
        
        if (!update) continue;
        if (token.document.isLinked) {
            update._id = token.actor.id;
            updates.push(update);
        }
        else token.actor.update(update);
    }

    Actor.implementation.updateDocuments(updates);
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

function getVigorSetting(actor) {
    const healthConfig = game.settings.get("pf1", "healthConfig");
    const hpActorConfig = healthConfig.getActorConfig(actor);
    return hpActorConfig.rules.useWoundsAndVigor;
}