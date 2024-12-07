// shared/game/CardClasses.js

class Card {
    constructor(id, name, manaCost, effect, image, rarity) {
        this.id = id;
        this.name = name;
        this.manaCost = manaCost;
        this.effect = effect;
        this.image = image;
        this.rarity = rarity;
    }
}

class UnitCard extends Card {
    constructor(id, name, manaCost, attack, health, effect, image, rarity) {
        super(id, name, manaCost, effect, image, rarity);
        this.type = 'unit';
        this.attack = attack;
        this.health = health;
        this.maxHealth = health;
        this.canAttack = false;
        this.hasAttacked = false;
        this.frozen = false;
        this.hasTaunt = effect?.toLowerCase().includes('taunt');
        this.hasDivineShield = effect?.toLowerCase().includes('divine shield');
    }
}

class SpellCard extends Card {
    constructor(id, name, manaCost, effect, image, rarity) {
        super(id, name, manaCost, effect, image, rarity);
        this.type = 'spell';
    }
}

class Hero {
    constructor(name, health, heroData = null) {
        this.name = name;
        this.health = health;
        this.maxHealth = health;
        this.hasUsedAbility = false;
        
        if (heroData) {
            this.id = heroData.id;
            this.abilityName = heroData.ability_name;
            this.abilityDescription = heroData.ability_description;
            this.abilityCost = heroData.ability_cost;
            this.image = heroData.image;
        }
    }
}

module.exports = {
    Card,
    UnitCard,
    SpellCard,
    Hero
};
