import { useState, useEffect, useRef } from "react";

var DOLLAR = "$";
function money(n) { return DOLLAR + n + "M"; }
function signed(n) { return (n >= 0 ? "+" : "") + n; }
function signedM(n) { return (n >= 0 ? "+" : "") + DOLLAR + n + "M"; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Exponential scaling: value from -50 to 50, returns multiplier
// At 0: 1.0x, at 50: ~3.0x, at -50: ~0.3x (exponential curve)
function expScale(val, base) {
  return base * Math.pow(1.025, val);
}

var NATIONS = [
  { id: "britain", name: "Britain", flag: "\u{1F1EC}\u{1F1E7}", intro: 1796 },
  { id: "france", name: "France", flag: "\u{1F1EB}\u{1F1F7}", intro: 1796 },
  { id: "spain", name: "Spain", flag: "\u{1F1EA}\u{1F1F8}", intro: 1796 },
  { id: "mexico", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}", intro: 1823 },
  { id: "russia", name: "Russia", flag: "\u{1F1F7}\u{1F1FA}", intro: 1823 },
  { id: "japan", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}", intro: 1898 },
  { id: "germany", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}", intro: 1898 },
  { id: "cuba", name: "Cuba", flag: "\u{1F1E8}\u{1F1FA}", intro: 1898 },
  { id: "philippines", name: "Philippines", flag: "\u{1F1F5}\u{1F1ED}", intro: 1899 },
  { id: "panama", name: "Panama", flag: "\u{1F1F5}\u{1F1E6}", intro: 1904 },
  { id: "china", name: "China", flag: "\u{1F1E8}\u{1F1F3}", intro: 1900 },
];
function getActiveNations(y) { return NATIONS.filter(function(n) { return y >= n.intro; }); }

// ══════ ACHIEVEMENTS ══════
var ACHIEVEMENT_DEFS = [
  { id: "beat_easy", icon: "\u{1F7E2}", name: "First Steps", desc: "Complete a run on Easy difficulty" },
  { id: "beat_normal", icon: "\u{1F535}", name: "Capable Leader", desc: "Complete a run on Normal difficulty" },
  { id: "beat_hard", icon: "\u{1F7E0}", name: "Iron President", desc: "Complete a run on Hard difficulty" },
  { id: "beat_brutal", icon: "\u{1F534}", name: "God of War", desc: "Complete a run on Brutal difficulty" },
  { id: "all_territory", icon: "\u{1F5FA}", name: "Manifest Destiny", desc: "Own 5+ territories in a single run" },
  { id: "pacifist", icon: "\u{1F54A}", name: "Peacemaker", desc: "Complete a run without any nation going Hostile (below -30)" },
  { id: "max_dom", icon: "\u{1F3DB}", name: "Beloved Leader", desc: "Reach 50 Domestic approval" },
  { id: "max_intl", icon: "\u{1F30D}", name: "World Diplomat", desc: "Reach 50 International reputation" },
  { id: "max_pwr", icon: "\u2694\uFE0F", name: "Superpower", desc: "Reach 50 World Power" },
  { id: "debt_free", icon: "\u{1F4B0}", name: "Debt Free", desc: "Finish a run with zero outstanding loans and 100+ gold" },
  { id: "loan_shark", icon: "\u{1F3E6}", name: "Loan Shark", desc: "Have 3+ active loans simultaneously" },
  { id: "warmonger", icon: "\u{1F525}", name: "Warmonger", desc: "Be at war with 3+ nations at once" },
  { id: "s_rank", icon: "\u{1F31F}", name: "Legendary", desc: "Achieve an S rank (90+ score)" },
  { id: "all_terms", icon: "\u{1F4DA}", name: "Scholar", desc: "Complete a 30-event run (see all terms)" },
];

function loadAchievements() {
  try {
    var raw = window.localStorage ? window.localStorage.getItem("cic_achievements") : null;
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}
function saveAchievements(a) {
  try { if (window.localStorage) window.localStorage.setItem("cic_achievements", JSON.stringify(a)); } catch(e) {}
}

// ══════ EVENTS ══════
var ALL_EVENTS = [
  { id: "washington_farewell", year: 1796, duration: "instant", title: "Washington's Farewell Address", desc: "President Washington warns the young nation to avoid foreign entanglements.", termDef: "Washington's Farewell Address (1796): Advised avoiding foreign entanglements.", choices: [
    { text: "Embrace isolationism fully \u2014 we build inward", dom: 15, intl: -12, pwr: -5, gold: 20, nations: { britain: -8, france: -8, spain: -5 }, policies: ["Isolationism"], cost: 0 },
    { text: "Pay lip service but quietly build foreign trade networks", dom: -8, intl: 8, pwr: 10, gold: -10, nations: { britain: 10, france: 5 }, policies: ["Shadow Diplomacy"], cost: 15 },
    { text: "Publicly disagree \u2014 America should engage now", dom: -15, intl: 15, pwr: 5, gold: -5, nations: { britain: 10, france: 10, spain: -5 }, policies: ["Open Diplomacy"], cost: 10 },
  ]},
  { id: "la_purchase", year: 1803, duration: "instant", title: "The Louisiana Purchase", desc: "Napoleon offers the entire Louisiana Territory. Double the nation's size but at great cost.", termDef: "Exception 1 to isolationism: Louisiana Purchase \u2014 massive territorial expansion.", choices: [
    { text: "Buy it all \u2014 the deal of a century", dom: 10, intl: -8, pwr: 20, gold: -5, nations: { france: 15, spain: -15 }, policies: [], cost: 60, purchase: "Louisiana Territory" },
    { text: "Buy key regions and invest savings in the navy", dom: -5, intl: -5, pwr: 15, gold: -5, nations: { france: -5, spain: -5 }, policies: ["Naval Investment"], cost: 40, purchase: "Partial Louisiana" },
    { text: "Reject \u2014 unconstitutional and we can't afford enemies", dom: -8, intl: -10, pwr: -15, gold: 15, nations: { france: -15, spain: 5 }, policies: [], cost: 0 },
  ]},
  { id: "war_1812", year: 1812, duration: "short", title: "War of 1812", desc: "Britain impresses American sailors and backs Native resistance. War hawks demand action.", termDef: "Exception 2 to isolationism: War of 1812 \u2014 conflict with Britain.", choices: [
    { text: "Declare war on Britain \u2014 sovereignty demands it", dom: 10, intl: -15, pwr: 10, gold: -15, nations: { britain: -30, france: 10 }, policies: [], cost: 50 },
    { text: "Embargo British goods and build up the navy", dom: -10, intl: -5, pwr: 8, gold: -15, nations: { britain: -10, france: -5 }, policies: ["Naval Expansion"], cost: 35 },
    { text: "Negotiate concessions \u2014 swallow our pride", dom: -12, intl: 10, pwr: -8, gold: 5, nations: { britain: 10, france: -10 }, policies: [], cost: 10 },
  ]},
  { id: "bonus_pirates", year: 1820, duration: "short", title: "Caribbean Pirate Crisis \u2605", desc: "\u2605 BONUS: Pirates raid American merchant ships in the Caribbean!", termDef: "\u2605 BONUS: Not a test term!", choices: [
    { text: "Send the Navy to sweep the Caribbean", dom: 10, intl: -5, pwr: 15, gold: -10, nations: { britain: 5, spain: -10 }, policies: [], cost: 35 },
    { text: "Hire privateers to fight pirates", dom: -5, intl: -10, pwr: 5, gold: -5, nations: { spain: -5, britain: -5 }, policies: [], cost: 15 },
    { text: "Pay protection money \u2014 cheaper than war", dom: -12, intl: -8, pwr: -5, gold: 10, nations: { britain: -5 }, policies: [], cost: 5 },
  ]},
  { id: "monroe_doctrine", year: 1823, duration: "long", title: "The Monroe Doctrine", desc: "European powers eye Latin America. Declare the hemisphere off-limits?", termDef: "Monroe Doctrine (1823): Americas are a no-Europe zone. USA is protector of Latin America. Not enforced.", choices: [
    { text: "Issue the Doctrine boldly \u2014 the Americas are OURS", dom: 15, intl: -12, pwr: 15, gold: -10, nations: { britain: -10, france: -10, spain: -15, mexico: 10, russia: -5 }, policies: ["Monroe Doctrine"], cost: 25 },
    { text: "Partner with Britain to jointly oppose Europe", dom: -10, intl: 8, pwr: -5, gold: -5, nations: { britain: 20, france: -15, spain: -10, mexico: -5 }, policies: ["Anglo-American Alliance"], cost: 15 },
    { text: "Stay silent \u2014 let them sort it out", dom: -8, intl: -5, pwr: -10, gold: 10, nations: { britain: 5, mexico: -10, russia: 5 }, policies: [], cost: 0 },
  ]},
  { id: "polk_expansion", year: 1845, duration: "short", title: "Territorial Expansion Under Polk", desc: "Annex Texas, claim Oregon, push westward. Mexico and Britain object.", termDef: "Territorial Expansion (James K. Polk): Annexed Texas, Oregon Territory, Mexican-American War.", choices: [
    { text: "Full expansion \u2014 Texas, Oregon, provoke Mexico", dom: 10, intl: -20, pwr: 25, gold: -20, nations: { mexico: -40, britain: -15 }, policies: ["Manifest Destiny"], cost: 80, purchase: "Texas + Oregon" },
    { text: "Annex Texas but concede northern Oregon", dom: -5, intl: -8, pwr: 10, gold: -5, nations: { mexico: -20, britain: 10 }, policies: [], cost: 30, purchase: "Texas" },
    { text: "Take only Texas and fortify the border", dom: -8, intl: 5, pwr: 5, gold: -15, nations: { mexico: -15, britain: 5 }, policies: ["Border Fortification"], cost: 25, purchase: "Texas (fortified)" },
  ]},
  { id: "mexican_american_war", year: 1846, duration: "short", title: "Mexican-American War", desc: "Shots fired on disputed land. A full campaign to California costs dearly.", termDef: "Mexican-American War: Part of Polk's territorial expansion.", choices: [
    { text: "Full campaign \u2014 take everything to California", dom: 5, intl: -20, pwr: 20, gold: -20, nations: { mexico: -40, britain: -5 }, policies: [], cost: 70, purchase: "Mexican Cession" },
    { text: "Fight defensively \u2014 protect Texas, bleed resources", dom: -5, intl: -8, pwr: 5, gold: -10, nations: { mexico: -15, britain: -5 }, policies: [], cost: 30 },
    { text: "Seek peace but demand Rio Grande border", dom: -10, intl: 5, pwr: -10, gold: 5, nations: { mexico: -5, britain: 5 }, policies: [], cost: 10 },
  ]},
  { id: "civil_war_pause", year: 1861, duration: "short", title: "Civil War Halts Expansion", desc: "The nation tears itself apart. Europe considers recognizing the Confederacy.", termDef: "Civil War: Put a pause on westward expansion.", choices: [
    { text: "Focus inward \u2014 preserve the Union at all costs", dom: 15, intl: -12, pwr: -8, gold: -30, nations: { britain: -10, france: -10 }, policies: ["Union Preservation"], cost: 100 },
    { text: "Bribe Europe with trade deals to stay out", dom: -8, intl: 5, pwr: -5, gold: -25, nations: { britain: 10, france: 10 }, policies: [], cost: 60 },
    { text: "Threaten Europe \u2014 back the South and face us", dom: 5, intl: -15, pwr: 5, gold: -25, nations: { britain: -20, france: -15 }, policies: [], cost: 70 },
  ]},
  { id: "sewards_folly", year: 1867, duration: "instant", title: "Seward's Folly", desc: "Buy Alaska from Russia? Critics call it insane.", termDef: "Seward's Folly: USA purchases Alaska from Russia.", choices: [
    { text: "Buy Alaska at full price \u2014 keep Russia happy", dom: -12, intl: 5, pwr: 15, gold: -10, nations: { russia: 20, britain: -5 }, policies: [], cost: 45, purchase: "Alaska" },
    { text: "Lowball Russia \u2014 take it or leave it", dom: -5, intl: -8, pwr: 10, gold: -5, nations: { russia: -5, britain: -5 }, policies: [], cost: 25, purchase: "Alaska (grudging)" },
    { text: "Reject \u2014 spend money on Reconstruction", dom: 10, intl: -5, pwr: -10, gold: 5, nations: { russia: -15 }, policies: [], cost: 10 },
  ]},
  { id: "economic_imperialism", year: 1875, duration: "long", title: "Economic Imperialism Begins", desc: "United Fruit builds towns in Guatemala. Companies reshape foreign economies.", termDef: "Economic Imperialism (Gilded Age): USA doesn't interfere with companies. Guatemala/United Fruit. Banana Republic: economy on one product.", choices: [
    { text: "Let business handle business \u2014 profits flow home", dom: 10, intl: -12, pwr: 15, gold: 25, nations: { mexico: -15, cuba: -10 }, policies: ["Laissez-Faire Abroad"], cost: 0 },
    { text: "Regulate abroad \u2014 protect our reputation", dom: -8, intl: 10, pwr: -8, gold: -10, nations: { mexico: 10, cuba: 5 }, policies: ["Foreign Regulation"], cost: 25 },
    { text: "Use companies as covert foreign policy tools", dom: -5, intl: -15, pwr: 20, gold: 10, nations: { mexico: -15, britain: -5 }, policies: ["Corporate Diplomacy"], cost: 15 },
  ]},
  { id: "hawaii_annexation", year: 1893, duration: "instant", title: "The Hawaii Question", desc: "Sugar companies overthrew Hawaii's monarchy. They want annexation.", termDef: "Hawaii (Sugar Companies): USA annexes Hawaii for US sugar companies.", choices: [
    { text: "Annex Hawaii \u2014 strategically vital", dom: 5, intl: -15, pwr: 20, gold: 10, nations: { japan: -20, britain: -5 }, policies: [], cost: 25, purchase: "Hawaii" },
    { text: "Restore the monarchy \u2014 anger sugar barons", dom: -12, intl: 15, pwr: -8, gold: -15, nations: { japan: 10, britain: 10 }, policies: [], cost: 15 },
    { text: "Make it a protectorate \u2014 please nobody", dom: -5, intl: -8, pwr: 10, gold: 0, nations: { japan: -10, britain: -5 }, policies: [], cost: 15 },
  ]},
  { id: "bonus_worlds_fair", year: 1893, duration: "instant", title: "World's Columbian Exposition \u2605", desc: "\u2605 BONUS: Chicago hosts a World's Fair!", termDef: "\u2605 BONUS: Not a test term!", choices: [
    { text: "Spare no expense \u2014 greatest fair ever", dom: 12, intl: 12, pwr: -5, gold: -20, nations: { britain: 10, france: 10, germany: 10, japan: 10 }, policies: [], cost: 55 },
    { text: "Showcase military technology", dom: 5, intl: -12, pwr: 15, gold: -10, nations: { germany: -10, japan: -10, britain: 5 }, policies: [], cost: 30 },
    { text: "Cut corners \u2014 save money, embarrass the nation", dom: -10, intl: -8, pwr: -5, gold: 15, nations: { britain: -5, france: -5 }, policies: [], cost: 5 },
  ]},
  { id: "spanish_american_war", year: 1898, duration: "short", title: "The Spanish-American War", desc: "Cuba fights Spain. The USS Maine explodes. War could yield an empire.", termDef: "Spanish-American War (1898): USA helps Cuba fight for independence. USA wants imperial power.", choices: [
    { text: "War on all fronts \u2014 Cuba AND Philippines", dom: 15, intl: -15, pwr: 25, gold: -15, nations: { spain: -40, cuba: 10, japan: -10, germany: -5, philippines: -10 }, policies: ["Imperial Expansion"], cost: 70, purchase: "Philippines + Guam + PR" },
    { text: "Help Cuba only \u2014 demand a naval base in return", dom: -5, intl: -8, pwr: 12, gold: -5, nations: { spain: -20, cuba: -5, japan: 5 }, policies: ["Cuban Base"], cost: 30 },
    { text: "Mediate peacefully \u2014 look weak but save lives", dom: -12, intl: 10, pwr: -10, gold: 5, nations: { spain: 5, cuba: -15, britain: -5 }, policies: [], cost: 10 },
  ]},
  { id: "manila_bay", year: 1898, duration: "instant", title: "Battle of Manila Bay", desc: "Admiral Dewey approaches the Spanish fleet. The Pacific hangs in the balance.", termDef: "Battle of Manila Bay: Major USA victory, gains multiple Spanish colonies.", choices: [
    { text: "Attack at dawn \u2014 destroy the fleet", dom: 15, intl: -8, pwr: 20, gold: -5, nations: { spain: -20, japan: -15, philippines: -10 }, policies: [], cost: 25 },
    { text: "Blockade and starve them out", dom: -5, intl: -5, pwr: 10, gold: -3, nations: { spain: -10, japan: -10, philippines: -5 }, policies: [], cost: 15 },
    { text: "Offer Spain a buyout for the colonies", dom: -10, intl: 8, pwr: -5, gold: -15, nations: { spain: 5, japan: 5, philippines: 5 }, policies: [], cost: 30 },
  ]},
  { id: "filipino_american_war", year: 1899, duration: "short", title: "Filipino-American War", desc: "Filipinos expected independence, not colonialism. Atrocity reports surface.", termDef: "Filipino-American War (1899-1902): ~200k Filipino deaths, ~4,000 American. USA commits war crimes.", choices: [
    { text: "Crush the rebellion \u2014 Philippines stay ours", dom: -5, intl: -20, pwr: 15, gold: -15, nations: { philippines: -40, japan: -10, britain: -5 }, policies: [], cost: 50 },
    { text: "Gradual self-governance \u2014 expensive transition", dom: -8, intl: 10, pwr: -5, gold: -10, nations: { philippines: 10, japan: 5, britain: -5 }, policies: ["Philippine Autonomy"], cost: 25 },
    { text: "Immediate independence \u2014 abandon our Pacific position", dom: -10, intl: 15, pwr: -15, gold: 5, nations: { philippines: 30, japan: 15, britain: -10 }, policies: [], cost: 5 },
  ]},
  { id: "platt_amendment", year: 1901, duration: "long", title: "The Platt Amendment", desc: "Cuba is 'independent' but you can add a re-invasion clause.", termDef: "Platt Amendment: USA can re-invade Cuba if things get out of hand.", choices: [
    { text: "Insert the Platt Amendment \u2014 Cuba needs oversight", dom: 10, intl: -15, pwr: 15, gold: 5, nations: { cuba: -30, mexico: -10 }, policies: ["Platt Amendment"], cost: 10 },
    { text: "Grant sovereignty but station troops 'temporarily'", dom: -5, intl: -8, pwr: 10, gold: -5, nations: { cuba: -10, mexico: -5 }, policies: ["Cuba Garrison"], cost: 15 },
    { text: "Full sovereignty \u2014 lose all leverage", dom: -8, intl: 15, pwr: -10, gold: 0, nations: { cuba: 25, mexico: 10 }, policies: [], cost: 0 },
  ]},
  { id: "mckinley_roosevelt", year: 1901, duration: "instant", title: "McKinley Shot \u2014 Roosevelt Takes Office", desc: "The Rough Rider hero of San Juan Hill becomes president.", termDef: "McKinley: President during Spanish-American War. T. Roosevelt: President after. Rough Riders / San Juan Hill.", choices: [
    { text: "'Speak softly and carry a big stick'", dom: 10, intl: -8, pwr: 20, gold: -10, nations: { britain: 5, germany: -10, japan: -10 }, policies: ["Big Stick Diplomacy"], cost: 20 },
    { text: "Continue McKinley's policies \u2014 steady but uninspiring", dom: -5, intl: -5, pwr: -5, gold: 5, nations: { britain: -5 }, policies: [], cost: 0 },
    { text: "Pull back from imperialism \u2014 alienate the military", dom: -8, intl: 15, pwr: -12, gold: 10, nations: { cuba: 5, philippines: 5, britain: -10 }, policies: [], cost: 0 },
  ]},
  { id: "roosevelt_corollary", year: 1904, duration: "long", title: "The Roosevelt Corollary", desc: "Latin America defaults on debts. Europe threatens. Police the hemisphere?", termDef: "Roosevelt Corollary: Amendment to Monroe Doctrine. USA is world police.", choices: [
    { text: "Declare the Corollary \u2014 we police the hemisphere", dom: 10, intl: -15, pwr: 20, gold: -15, nations: { mexico: -15, cuba: -15, britain: 5, germany: -5, panama: -10 }, policies: ["Roosevelt Corollary"], cost: 45 },
    { text: "Help Latin nations negotiate \u2014 slow and expensive", dom: -5, intl: 8, pwr: -5, gold: -10, nations: { mexico: 10, cuba: 5, britain: -5, germany: -5 }, policies: [], cost: 20 },
    { text: "Let Europe collect debts \u2014 Monroe Doctrine crumbles", dom: -8, intl: -8, pwr: -12, gold: 15, nations: { britain: 5, germany: 10, mexico: -10, cuba: -5 }, policies: [], cost: 0 },
  ]},
  { id: "panama_canal", year: 1904, duration: "long", title: "The Panama Canal", desc: "A canal would transform trade. Colombia says no...", termDef: "Panama Canal (1904-1914): Massive canal through Panama, commissioned by USA.", choices: [
    { text: "Support Panamanian independence, build canal", dom: 10, intl: -15, pwr: 25, gold: -25, nations: { panama: 15, mexico: -15, britain: 5 }, policies: [], cost: 100, purchase: "Panama Canal" },
    { text: "Pay Colombia triple \u2014 keep it clean", dom: -5, intl: 5, pwr: 10, gold: -20, nations: { panama: -10, mexico: 5 }, policies: [], cost: 80, purchase: "Canal (expensive)" },
    { text: "Build through Nicaragua \u2014 angers Panama", dom: -5, intl: -5, pwr: 12, gold: -15, nations: { panama: -20, mexico: -5, britain: -5 }, policies: [], cost: 55, purchase: "Nicaragua Canal" },
  ]},
  { id: "great_white_fleet", year: 1907, duration: "short", title: "The Great White Fleet", desc: "16 battleships circling the globe. Awe-inspiring and expensive.", termDef: "Great White Fleet: State-of-the-art navy commissioned by Roosevelt.", choices: [
    { text: "Send the full Fleet! Let the world tremble", dom: 10, intl: -12, pwr: 25, gold: -15, nations: { japan: -20, germany: -10, britain: 5 }, policies: ["Naval Supremacy"], cost: 65 },
    { text: "Smaller fleet to allies \u2014 annoy rivals cheaply", dom: -5, intl: -5, pwr: 10, gold: -5, nations: { britain: 10, japan: -10, germany: -5 }, policies: [], cost: 25 },
    { text: "Invest in infrastructure \u2014 look weak abroad", dom: 12, intl: -8, pwr: -8, gold: 5, nations: { japan: 5, germany: 5 }, policies: [], cost: 15 },
  ]},
  { id: "wilson_neutrality", year: 1914, duration: "short", title: "Woodrow Wilson and the Great War", desc: "War erupts in Europe. Trading with belligerents is profitable...", termDef: "Woodrow Wilson: President during WWI, academic. Didn't want to join WWI.", choices: [
    { text: "Strict neutrality \u2014 lose trade from everyone", dom: 5, intl: -5, pwr: -8, gold: -15, nations: { britain: -10, france: -10, germany: -10 }, policies: ["Strict Neutrality"], cost: 0 },
    { text: "Trade with everyone \u2014 profit from suffering", dom: -8, intl: -10, pwr: 10, gold: 25, nations: { germany: -15, britain: 5, france: 5 }, policies: ["War Profiteering"], cost: 0 },
    { text: "Lean toward Allies \u2014 paint a target on us", dom: -5, intl: -8, pwr: 10, gold: 15, nations: { britain: 15, france: 15, germany: -25 }, policies: ["Pro-Allied"], cost: 0 },
  ]},
  { id: "lusitania", year: 1915, duration: "instant", title: "Sinking of the Lusitania", desc: "German U-boat torpedoes a passenger liner. 1,198 dead, 128 Americans.", termDef: "Lusitania: British passenger vessel sunk, brought America into WWI.", choices: [
    { text: "Act of war \u2014 mobilize immediately", dom: 10, intl: -10, pwr: 15, gold: -15, nations: { germany: -30, britain: 15, france: 15 }, policies: [], cost: 35 },
    { text: "Demand Germany cease attacks \u2014 they might not listen", dom: -5, intl: -5, pwr: -5, gold: 0, nations: { germany: -10, britain: -5 }, policies: [], cost: 5 },
    { text: "Investigate \u2014 risk looking like a German apologist", dom: -12, intl: 8, pwr: -8, gold: 5, nations: { germany: 5, britain: -15, france: -10 }, policies: [], cost: 5 },
  ]},
  { id: "unrestricted_submarines", year: 1917, duration: "instant", title: "Unrestricted Submarine Warfare", desc: "Germany sinks any ship \u2014 neutral or not.", termDef: "Unrestricted Submarine Warfare: German WWI strategy.", choices: [
    { text: "Prepare for war \u2014 this crosses every line", dom: 10, intl: -8, pwr: 15, gold: -15, nations: { germany: -25, britain: 10, france: 10 }, policies: [], cost: 30 },
    { text: "Arm merchant ships \u2014 satisfies nobody", dom: -5, intl: -5, pwr: 5, gold: -10, nations: { germany: -10, britain: -5 }, policies: ["Armed Neutrality"], cost: 20 },
    { text: "Suspend shipping \u2014 economic catastrophe", dom: -15, intl: 5, pwr: -10, gold: -25, nations: { germany: 5, britain: -15 }, policies: [], cost: 0 },
  ]},
  { id: "zimmerman_telegram", year: 1917, duration: "instant", title: "The Zimmermann Telegram", desc: "Germany asks Mexico to attack America. Promises Texas, NM, Arizona.", termDef: "Zimmermann Telegram (1917): German telegram to Mexico asking them to attack America.", choices: [
    { text: "Publish and declare war on Germany", dom: 20, intl: -5, pwr: 20, gold: -20, nations: { germany: -40, mexico: -10, britain: 20, france: 20 }, policies: ["WWI Entry"], cost: 55 },
    { text: "Use as leverage \u2014 Germany knows you're bluffing", dom: -8, intl: -5, pwr: -5, gold: 0, nations: { germany: -15, mexico: -5 }, policies: [], cost: 5 },
    { text: "Confront Mexico publicly \u2014 humiliate a neighbor", dom: 5, intl: -10, pwr: 5, gold: 0, nations: { mexico: -15, germany: -5 }, policies: [], cost: 5 },
  ]},
  { id: "armistice", year: 1918, duration: "instant", title: "Armistice \u2014 End of WWI", desc: "Germany requests ceasefire. What kind of peace?", termDef: "Armistice: Ceasefire ending WWI.", choices: [
    { text: "Fair peace \u2014 anger hardliners at home", dom: -8, intl: 15, pwr: -5, gold: 5, nations: { germany: 10, britain: 5, france: -10 }, policies: [], cost: 0 },
    { text: "Push into Germany \u2014 more death, decisive victory", dom: 5, intl: -15, pwr: 15, gold: -25, nations: { germany: -30, britain: 5, france: 10 }, policies: [], cost: 45 },
    { text: "Accept but skip peace talks \u2014 waste leverage", dom: 5, intl: -12, pwr: -8, gold: 15, nations: { britain: -15, france: -15, germany: 5 }, policies: ["Post-War Isolation"], cost: 0 },
  ]},
  { id: "fourteen_points", year: 1919, duration: "instant", title: "Wilson's 14 Points", desc: "Self-determination, free seas, no tariffs, League of Nations.", termDef: "14 Points: Wilson's plan \u2014 rethink colonialism, self-determination, free seas, no tariffs.", choices: [
    { text: "Champion all 14 points \u2014 alienate Congress", dom: -12, intl: 20, pwr: 5, gold: -10, nations: { britain: 5, france: -5, germany: 10, japan: 5 }, policies: ["Wilsonian Idealism"], cost: 20 },
    { text: "Compromise \u2014 punish Germany, breed resentment", dom: -5, intl: 5, pwr: 5, gold: 0, nations: { germany: -25, britain: 10, france: 15 }, policies: [], cost: 5 },
    { text: "Focus on American interests \u2014 betray our ideals", dom: 10, intl: -12, pwr: 10, gold: 15, nations: { britain: -10, france: -10, germany: -5 }, policies: [], cost: 0 },
  ]},
  { id: "league_of_nations", year: 1920, duration: "instant", title: "The League of Nations Debate", desc: "Wilson's League. Senator Lodge leads opposition.", termDef: "League of Nations: Proposed by USA. Henry Cabot Lodge opposed. Internationalist: wants global cooperation.", choices: [
    { text: "Rally the nation for the League \u2014 exhaust yourself", dom: -12, intl: 15, pwr: 5, gold: -10, nations: { britain: 10, france: 10, japan: 5 }, policies: ["League Member"], cost: 15 },
    { text: "Compromise with Lodge \u2014 watered-down League", dom: -5, intl: -5, pwr: -5, gold: 0, nations: { britain: -5, france: -5 }, policies: ["Modified League"], cost: 5 },
    { text: "Abandon the League \u2014 allies despair", dom: 10, intl: -15, pwr: -8, gold: 10, nations: { britain: -15, france: -15 }, policies: ["League Rejection"], cost: 0 },
  ]},
  { id: "bonus_transatlantic", year: 1927, duration: "instant", title: "Transatlantic Flight Mania \u2605", desc: "\u2605 BONUS: Solo Atlantic crossing! Fund aviation?", termDef: "\u2605 BONUS: Not a test term!", choices: [
    { text: "Fund massive government aviation program", dom: 8, intl: 5, pwr: 15, gold: -15, nations: { britain: 5, france: 5 }, policies: ["Aviation Program"], cost: 40 },
    { text: "Leverage for air route negotiations \u2014 anger airlines", dom: -8, intl: 10, pwr: 5, gold: -5, nations: { britain: 10, france: 10 }, policies: [], cost: 15 },
    { text: "Do nothing \u2014 private sector won't step up", dom: -5, intl: -5, pwr: -5, gold: 5, nations: {}, policies: [], cost: 0 },
  ]},
  { id: "fdr_good_neighbor", year: 1933, duration: "long", title: "FDR's Good Neighbor Policy", desc: "No more Latin American invasions. Repeal the Platt Amendment.", termDef: "FDR: Good Neighbor Policy (1933). Abandon the Platt Amendment.", choices: [
    { text: "Full Good Neighbor \u2014 repeal Platt, lose bases", dom: -5, intl: 20, pwr: -12, gold: 5, nations: { cuba: 25, mexico: 20, panama: 15 }, policies: ["Good Neighbor Policy"], cost: 10 },
    { text: "Soften approach but secretly keep bases", dom: -5, intl: -5, pwr: 5, gold: -5, nations: { cuba: -5, mexico: 5, panama: -5 }, policies: ["Shadow Bases"], cost: 15 },
    { text: "Double down on control \u2014 hemisphere hates us", dom: 5, intl: -18, pwr: 12, gold: 5, nations: { cuba: -15, mexico: -20, panama: -10 }, policies: [], cost: 0 },
  ]},
  { id: "neutrality_acts", year: 1935, duration: "short", title: "The Neutrality Acts", desc: "Fascism rises. Congress bans arms sales to warring nations.", termDef: "Neutrality Acts (1935, 36, 37): US won't get involved in European wars.", choices: [
    { text: "Support the Acts \u2014 handcuff yourself when war comes", dom: 15, intl: -12, pwr: -12, gold: 10, nations: { britain: -15, france: -15, germany: 5 }, policies: ["Neutrality Acts"], cost: 0 },
    { text: "Sign but secretly rearm \u2014 expensive deception", dom: -5, intl: -5, pwr: 8, gold: -15, nations: { germany: -5 }, policies: ["Secret Rearmament"], cost: 35 },
    { text: "Oppose openly \u2014 political suicide at home", dom: -18, intl: 10, pwr: 10, gold: -5, nations: { britain: 15, france: 15, germany: -15 }, policies: [], cost: 10 },
  ]},
  { id: "hitler_poland", year: 1939, duration: "instant", title: "Hitler Invades Poland", desc: "WWII begins. Britain and France declare war.", termDef: "Hitler's Invasion of Poland (1939): Starts WWII.", choices: [
    { text: "Maintain neutrality \u2014 watch democracy fall", dom: 10, intl: -12, pwr: -8, gold: 10, nations: { britain: -20, france: -20, germany: 5 }, policies: [], cost: 0 },
    { text: "Allow Cash and Carry \u2014 profit, anger Germany", dom: -5, intl: -5, pwr: 10, gold: 10, nations: { britain: 10, france: 10, germany: -20 }, policies: ["Cash and Carry"], cost: 5 },
    { text: "Secret military planning \u2014 risk exposure", dom: -12, intl: 8, pwr: 10, gold: -15, nations: { britain: 20, france: 20, germany: -25 }, policies: ["Secret Alliance"], cost: 25 },
  ]},
  { id: "cash_and_carry", year: 1939, duration: "short", title: "Cash and Carry Policy", desc: "Belligerents buy American goods \u2014 pay cash, ship themselves.", termDef: "Cash and Carry (1939): Britain buys American goods, pays cash, transports them.", choices: [
    { text: "Cash and Carry for Allies only \u2014 anger Axis", dom: -5, intl: -8, pwr: 10, gold: 15, nations: { britain: 15, france: 10, germany: -20, japan: -10 }, policies: ["Cash and Carry"], cost: 0 },
    { text: "Sell to anyone \u2014 arm both sides", dom: -10, intl: -12, pwr: 5, gold: 25, nations: { germany: 5, japan: 5, britain: -10 }, policies: [], cost: 0 },
    { text: "No sales at all \u2014 moral high ground, empty pockets", dom: 8, intl: -8, pwr: -12, gold: -15, nations: { britain: -15, france: -10, germany: -5 }, policies: [], cost: 0 },
  ]},
  { id: "lend_lease", year: 1941, duration: "short", title: "The Lend-Lease Act", desc: "Britain is broke. FDR proposes 'lending' military equipment.", termDef: "Lend-Lease Act (1941): America loans British military equipment.", choices: [
    { text: "Full Lend-Lease \u2014 Arsenal of Democracy bleeds money", dom: -8, intl: 12, pwr: 15, gold: -25, nations: { britain: 25, france: 10, russia: 15, germany: -20, japan: -15 }, policies: ["Lend-Lease"], cost: 85 },
    { text: "Britain only \u2014 abandon Soviets to Hitler", dom: -5, intl: -5, pwr: 10, gold: -10, nations: { britain: 20, russia: -15, germany: -10 }, policies: ["Limited Lend-Lease"], cost: 45 },
    { text: "Reject \u2014 let Britain fall, count our coins", dom: 10, intl: -18, pwr: -8, gold: 10, nations: { britain: -25, france: -10, germany: 10 }, policies: [], cost: 0 },
  ]},
  { id: "pearl_harbor", year: 1941, duration: "instant", title: "Bombing of Pearl Harbor", desc: "December 7, 1941. 2,403 Americans die.", termDef: "Bombing of Pearl Harbor (Dec. 7, 1941): Japan surprise attack. USA enters WWII.", choices: [
    { text: "Total war \u2014 Japan AND Germany, drain every dollar", dom: 20, intl: -5, pwr: 25, gold: -30, nations: { japan: -50, germany: -40, britain: 30, france: 20, russia: 20, china: 20 }, policies: ["Total War"], cost: 110 },
    { text: "War on Japan only \u2014 ignore Europe", dom: -5, intl: -10, pwr: 15, gold: -15, nations: { japan: -50, britain: -10, france: -10 }, policies: [], cost: 55 },
    { text: "Demand surrender first \u2014 nation screams for blood", dom: -20, intl: -10, pwr: -10, gold: 5, nations: { japan: 5, britain: -25, china: -15 }, policies: [], cost: 0 },
  ]},
  { id: "fdr_radio", year: 1941, duration: "instant", title: "FDR's 'Day of Infamy' Address", desc: "December 8th. FDR addresses Congress.", termDef: "FDR Radio Address (Dec. 8): FDR's response to Japan's attack.", choices: [
    { text: "'A date which will live in infamy' \u2014 total annihilation", dom: 20, intl: -5, pwr: 15, gold: -5, nations: { britain: 15, france: 10, russia: 10, china: 10, japan: -15 }, policies: [], cost: 5 },
    { text: "Cold strategic briefing \u2014 uninspiring but precise", dom: -8, intl: -5, pwr: 10, gold: 0, nations: { britain: -5 }, policies: [], cost: 0 },
    { text: "Emphasize peace \u2014 confuse a nation wanting revenge", dom: -12, intl: 12, pwr: -8, gold: 0, nations: { japan: 5, britain: -10, china: -5 }, policies: ["Peace-First"], cost: 0 },
  ]},
];

var SORTED_EVENTS = ALL_EVENTS.slice().sort(function(a, b) { return a.year - b.year; });

var ERAS = [
  { name: "Early Republic", range: [1796, 1830], color: "#5B7553" },
  { name: "Manifest Destiny", range: [1831, 1870], color: "#B8860B" },
  { name: "Gilded Age", range: [1871, 1900], color: "#8B4513" },
  { name: "Progressive Era", range: [1901, 1913], color: "#4A6670" },
  { name: "The Great War", range: [1914, 1920], color: "#8B3A3A" },
  { name: "Interwar Period", range: [1921, 1940], color: "#4A4A6A" },
  { name: "World War II", range: [1941, 1945], color: "#2F4F4F" },
];
function getEra(y) { for (var i = 0; i < ERAS.length; i++) { if (y >= ERAS[i].range[0] && y <= ERAS[i].range[1]) return ERAS[i]; } return ERAS[0]; }

var DIFF = {
  easy:   { label: "Easy",   statMult: 1.0, costMult: 0.6, goldMult: 1.5, startGold: 200, punishMult: 0.5, goThresh: -45, warThresh: null, loanReq: 10 },
  normal: { label: "Normal", statMult: 1.0, costMult: 1.0, goldMult: 1.0, startGold: 120, punishMult: 1.0, goThresh: -40, warThresh: -45,  loanReq: 15 },
  hard:   { label: "Hard",   statMult: 1.2, costMult: 1.4, goldMult: 0.7, startGold: 70,  punishMult: 1.8, goThresh: -35, warThresh: -35,  loanReq: 25 },
  brutal: { label: "Brutal", statMult: 1.5, costMult: 1.8, goldMult: 0.5, startGold: 40,  punishMult: 2.5, goThresh: -30, warThresh: -25,  loanReq: 35 },
};

// STAT_MAX is now 50
var STAT_MAX = 50;

function StatBar(props) {
  var mx = STAT_MAX;
  var pct = (clamp(props.value, -mx, mx) + mx) / (mx * 2) * 100;
  var warnPct = props.warn != null ? (props.warn + mx) / (mx * 2) * 100 : null;
  return (
    <div style={{ marginBottom: props.compact ? 4 : 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: 1, textTransform: "uppercase", color: "#9a9080", marginBottom: 2 }}>
        <span>{props.icon}{" "}{props.label}</span>
        <span style={{ color: props.value > 15 ? "#5B8C5A" : props.value < -15 ? "#B54444" : "#9a9080", fontWeight: 700 }}>{signed(props.value)}</span>
      </div>
      <div style={{ height: 5, background: "#2a2920", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", background: props.color, borderRadius: 3, transition: "width 0.5s ease" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#3a3830" }} />
        {warnPct != null && <div style={{ position: "absolute", left: warnPct + "%", top: -1, bottom: -1, width: 2, background: "#B54444", opacity: 0.6 }} />}
      </div>
      {props.desc && <div style={{ fontSize: 9, fontFamily: "var(--sans)", color: "#6a6050", marginTop: 2, lineHeight: 1.3 }}>{props.desc}</div>}
    </div>
  );
}

function Btn(props) {
  var s = Object.assign({ padding: "12px 24px", fontSize: 12, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, border: "none", borderRadius: 4, cursor: "pointer", transition: "all 0.2s" }, props.style || {});
  return <button onClick={props.onClick} disabled={props.disabled} style={s}>{props.children}</button>;
}

function Modal(props) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }} onClick={props.onClose}>
      <div style={{ background: "#1c1b17", border: "1px solid #3a3830", borderRadius: 10, padding: 24, maxWidth: 380, width: "100%" }} onClick={function(e) { e.stopPropagation(); }}>{props.children}</div>
    </div>
  );
}

function AchievementPanel(props) {
  var unlocked = props.achievements || {};
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 10 }}>{"Achievements ("}{Object.keys(unlocked).length}{"/"}{ACHIEVEMENT_DEFS.length}{")"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ACHIEVEMENT_DEFS.map(function(a) {
          var got = !!unlocked[a.id];
          return (
            <div key={a.id} style={{ padding: "10px 12px", background: got ? "rgba(91,117,83,0.1)" : "var(--card)", border: "1px solid " + (got ? "rgba(91,117,83,0.3)" : "var(--border)"), borderRadius: 6, opacity: got ? 1 : 0.5 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{got ? a.icon : "\u{1F512}"}</div>
              <div style={{ fontSize: 12, fontFamily: "var(--serif)", fontWeight: 600, color: got ? "var(--text)" : "var(--dim)" }}>{a.name}</div>
              <div style={{ fontSize: 10, fontFamily: "var(--sans)", color: "var(--dim)", lineHeight: 1.4 }}>{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════ MAIN APP ══════
export default function App() {
  var [screen, setScreen] = useState("title");
  var [tab, setTab] = useState("event");
  var [playerName, setPlayerName] = useState("");
  var [nameInput, setNameInput] = useState("");
  var [difficulty, setDifficulty] = useState("normal");
  var [eventCount, setEventCount] = useState(20);
  var [gameEvents, setGameEvents] = useState([]);
  var [idx, setIdx] = useState(0);
  var [stats, setStats] = useState({ dom: 25, intl: 25, pwr: 25 });
  var [gold, setGold] = useState(120);
  var [spent, setSpent] = useState(0);
  var [earned, setEarned] = useState(120);
  var [relations, setRelations] = useState({});
  var [policies, setPolicies] = useState([]);
  var [purchases, setPurchases] = useState([]);
  var [history, setHistory] = useState([]);
  var [result, setResult] = useState(null);
  var [showTerm, setShowTerm] = useState(false);
  var [gameOver, setGameOver] = useState(null);
  var [fadeIn, setFadeIn] = useState(true);
  var [loans, setLoans] = useState({});
  var [wars, setWars] = useState({});
  var [loanModal, setLoanModal] = useState(null);
  var [loanAmt, setLoanAmt] = useState(20);
  var [repayModal, setRepayModal] = useState(null);
  var [repayAmt, setRepayAmt] = useState(10);
  var [expHistory, setExpHistory] = useState({});
  var [expNation, setExpNation] = useState({});
  var [achievements, setAchievements] = useState(loadAchievements);
  var [achPopup, setAchPopup] = useState(null);

  var diff = DIFF[difficulty];
  var evt = gameEvents[idx];
  var era = evt ? getEra(evt.year) : ERAS[0];

  function unlock(id) {
    if (achievements[id]) return;
    var na = Object.assign({}, achievements);
    na[id] = Date.now();
    setAchievements(na);
    saveAchievements(na);
    var def = ACHIEVEMENT_DEFS.find(function(a) { return a.id === id; });
    if (def) {
      setAchPopup(def);
      setTimeout(function() { setAchPopup(null); }, 3500);
    }
  }

  // ── STAT EFFECT CALCULATIONS (exponential scaling) ──
  // Domestic: controls passive income. At 50: ~3.4x base, at -50: ~0.3x
  function calcIncome() {
    var baseIncome = expScale(stats.dom, 6); // 6 base, scales to ~20 at 50 dom
    var warDrain = Object.keys(wars).filter(function(k) { return wars[k]; }).length * 10;
    // Power reduces war cost
    var pwrReduction = expScale(stats.pwr, 1); // at 50 pwr, ~3.4x reduction
    var actualWarDrain = Math.round(warDrain / pwrReduction);
    return Math.max(0, Math.round(baseIncome * diff.goldMult) - actualWarDrain);
  }

  // Global rep: passive nation rep change per turn
  function calcRepDrift() {
    // At 50 intl: +2/turn to all, at -50: -2/turn to all, at 0: 0
    return Math.round(stats.intl * 0.04);
  }

  // Power: war cost reduction multiplier
  function calcWarCostMult() {
    // At 50: costs reduced to ~30%, at -50: costs increased to ~340%
    return 1 / expScale(stats.pwr, 1);
  }

  var income = calcIncome();
  var repDrift = calcRepDrift();

  function initGame() {
    var d = DIFF[difficulty];
    var req = SORTED_EVENTS.filter(function(e) { return !e.id.startsWith("bonus_"); });
    var bon = SORTED_EVENTS.filter(function(e) { return e.id.startsWith("bonus_"); });
    var pool = req.slice();
    bon.forEach(function(b) { if (Math.random() > 0.3) pool.push(b); });
    pool.sort(function(a, b) { return a.year - b.year; });
    var ct = Math.min(eventCount, pool.length);
    var step = pool.length / ct;
    var sel = [];
    for (var i = 0; i < ct; i++) sel.push(pool[Math.min(Math.floor(i * step), pool.length - 1)]);
    var seen = {};
    var unique = sel.filter(function(e) { if (seen[e.id]) return false; seen[e.id] = true; return true; });
    setGameEvents(unique); setIdx(0);
    setStats({ dom: 25, intl: 25, pwr: 25 });
    setGold(d.startGold); setSpent(0); setEarned(d.startGold);
    var ir = {}; NATIONS.forEach(function(n) { ir[n.id] = 0; });
    setRelations(ir); setPolicies([]); setPurchases([]); setHistory([]);
    setResult(null); setShowTerm(false); setGameOver(null); setFadeIn(true);
    setTab("event"); setLoans({}); setWars({});
    setExpHistory({}); setExpNation({});
  }

  function applyStat(val) { return val < 0 ? Math.round(val * diff.punishMult) : Math.round(val * diff.statMult); }
  function costOf(c) { return Math.round((c.cost || 0) * diff.costMult); }

  function checkMidGameAchievements(ns, nr, nw, nl) {
    if (ns.dom >= STAT_MAX) unlock("max_dom");
    if (ns.intl >= STAT_MAX) unlock("max_intl");
    if (ns.pwr >= STAT_MAX) unlock("max_pwr");
    var activeLoans = Object.keys(nl || loans).filter(function(k) { return (nl || loans)[k] > 0; }).length;
    if (activeLoans >= 3) unlock("loan_shark");
    var activeWars = Object.keys(nw || wars).filter(function(k) { return (nw || wars)[k]; }).length;
    if (activeWars >= 3) unlock("warmonger");
  }

  function checkEndGameAchievements() {
    var diffKey = difficulty;
    if (diffKey === "easy") unlock("beat_easy");
    if (diffKey === "normal") unlock("beat_normal");
    if (diffKey === "hard") unlock("beat_hard");
    if (diffKey === "brutal") unlock("beat_brutal");
    if (purchases.length >= 5) unlock("all_territory");
    var anyHostile = Object.values(relations).some(function(v) { return v < -30; });
    if (!anyHostile) unlock("pacifist");
    var noLoans = Object.keys(loans).filter(function(k) { return loans[k] > 0; }).length === 0;
    if (noLoans && gold >= 100) unlock("debt_free");
    var score = Math.round((stats.dom + stats.intl + stats.pwr + 150) / 3);
    if (score >= 90) unlock("s_rank");
    if (eventCount >= 30 && gameEvents.length >= 28) unlock("all_terms");
  }

  function applyChoice(c) {
    var cost = costOf(c);
    if (cost > gold) return;
    var ns = {
      dom: clamp(stats.dom + applyStat(c.dom), -STAT_MAX, STAT_MAX),
      intl: clamp(stats.intl + applyStat(c.intl), -STAT_MAX, STAT_MAX),
      pwr: clamp(stats.pwr + applyStat(c.pwr), -STAT_MAX, STAT_MAX),
    };
    var ng = Math.max(0, gold + Math.round((c.gold || 0) * diff.goldMult) - cost);
    var nr = Object.assign({}, relations);
    if (c.nations) { Object.keys(c.nations).forEach(function(nid) { if (nr[nid] !== undefined) nr[nid] = clamp(nr[nid] + applyStat(c.nations[nid]), -100, 50); }); }
    var nw = Object.assign({}, wars);
    if (diff.warThresh != null) { Object.keys(nr).forEach(function(nid) { if (nr[nid] <= diff.warThresh && !nw[nid]) { var nat = NATIONS.find(function(n) { return n.id === nid; }); if (nat && evt && evt.year >= nat.intro) nw[nid] = true; } }); }
    setStats(ns); setGold(ng); setSpent(function(p) { return p + cost; });
    var ge = Math.max(0, Math.round((c.gold || 0) * diff.goldMult));
    if (ge > 0) setEarned(function(p) { return p + ge; });
    setRelations(nr); setWars(nw);
    if (c.policies && c.policies.length) setPolicies(function(p) { return p.concat(c.policies); });
    if (c.purchase) setPurchases(function(p) { return p.concat([c.purchase]); });
    setResult(Object.assign({}, c, { actualCost: cost }));
    setShowTerm(true);
    setHistory(function(p) { return p.concat([{ event: evt, choice: c, stats: ns, gold: ng }]); });
    checkMidGameAchievements(ns, nr, nw, loans);
    var th = diff.goThresh;
    if (ns.dom <= th) setTimeout(function() { setGameOver("Your people have risen up. Impeachment is swift."); }, 800);
    else if (ns.intl <= th) setTimeout(function() { setGameOver("America is an international pariah."); }, 800);
    else if (ns.pwr <= th) setTimeout(function() { setGameOver("America has become irrelevant."); }, 800);
  }

  function faceConsequences() {
    var domP = -Math.round(10 * diff.punishMult);
    var intlP = -Math.round(8 * diff.punishMult);
    var pwrP = -Math.round(6 * diff.punishMult);
    var ns = { dom: clamp(stats.dom + domP, -STAT_MAX, STAT_MAX), intl: clamp(stats.intl + intlP, -STAT_MAX, STAT_MAX), pwr: clamp(stats.pwr + pwrP, -STAT_MAX, STAT_MAX) };
    setStats(ns);
    setResult({ text: "You couldn't act \u2014 crisis passes unresolved.", dom: domP, intl: intlP, pwr: pwrP, gold: 0, nations: {}, policies: [], cost: 0, actualCost: 0, isFaceConsequences: true });
    setShowTerm(true);
    setHistory(function(p) { return p.concat([{ event: evt, choice: { text: "Faced consequences" }, stats: ns, gold: gold }]); });
    var th = diff.goThresh;
    if (ns.dom <= th) setTimeout(function() { setGameOver("Paralyzed by poverty, government collapses."); }, 800);
    else if (ns.intl <= th) setTimeout(function() { setGameOver("Unable to act, allies abandon you."); }, 800);
    else if (ns.pwr <= th) setTimeout(function() { setGameOver("Without funds, America fades."); }, 800);
  }

  function nextEvent() {
    if (idx + 1 >= gameEvents.length) { checkEndGameAchievements(); setGameOver("victory"); return; }
    setFadeIn(false);
    setTimeout(function() {
      setIdx(function(p) { return p + 1; });
      setResult(null); setShowTerm(false); setFadeIn(true);
      var inc = calcIncome();
      var ng = gold + inc;
      setEarned(function(p) { return p + inc; });
      // Global rep drift
      var drift = calcRepDrift();
      var nr = Object.assign({}, relations);
      var nl = Object.assign({}, loans);
      // Apply loan decay
      Object.keys(nl).forEach(function(nid) { if (nl[nid] > 0) nr[nid] = clamp((nr[nid] || 0) - Math.max(2, Math.round(nl[nid] * 0.15)), -100, 50); });
      // Apply global rep drift
      if (drift !== 0) { Object.keys(nr).forEach(function(nid) { var nat = NATIONS.find(function(n) { return n.id === nid; }); var ne = gameEvents[idx + 1]; if (nat && ne && ne.year >= nat.intro) nr[nid] = clamp(nr[nid] + drift, -100, 50); }); }
      // War effects - power reduces war damage
      var wk = Object.keys(wars).filter(function(k) { return wars[k]; });
      if (wk.length > 0) {
        var wcm = calcWarCostMult();
        var wDom = -Math.round(6 * wk.length * diff.punishMult * wcm);
        var wIntl = -Math.round(4 * wk.length * diff.punishMult * wcm);
        var wPwr = -Math.round(2 * wk.length);
        setStats(function(p) { return { dom: clamp(p.dom + wDom, -STAT_MAX, STAT_MAX), intl: clamp(p.intl + wIntl, -STAT_MAX, STAT_MAX), pwr: clamp(p.pwr + wPwr, -STAT_MAX, STAT_MAX) }; });
        var wd = Math.round(12 * wk.length * diff.costMult * wcm);
        ng = Math.max(0, ng - wd);
        setSpent(function(p) { return p + wd; });
      }
      var nw = Object.assign({}, wars);
      if (diff.warThresh != null) { Object.keys(nr).forEach(function(nid) { if (nr[nid] <= diff.warThresh && !nw[nid]) { var nat = NATIONS.find(function(n) { return n.id === nid; }); var ne = gameEvents[idx + 1]; if (nat && ne && ne.year >= nat.intro) nw[nid] = true; } }); }
      setRelations(nr); setLoans(nl); setWars(nw); setGold(ng);
    }, 250);
  }

  function takeLoan(nid, amt) {
    var nl = Object.assign({}, loans); nl[nid] = (nl[nid] || 0) + amt;
    setLoans(nl); setGold(function(p) { return p + amt; }); setEarned(function(p) { return p + amt; }); setLoanModal(null);
    checkMidGameAchievements(stats, relations, wars, nl);
  }

  function repayLoan(nid, amt) {
    var actual = Math.min(amt, gold, loans[nid] || 0);
    if (actual <= 0) return;
    setLoans(function(p) { var o = Object.assign({}, p); o[nid] = Math.max(0, (o[nid] || 0) - actual); if (!o[nid]) delete o[nid]; return o; });
    setGold(function(p) { return p - actual; }); setSpent(function(p) { return p + actual; });
    setRelations(function(p) { var o = Object.assign({}, p); o[nid] = Math.min(50, (o[nid] || 0) + Math.round(actual * 0.1)); return o; });
    setRepayModal(null);
  }

  function canLoan(nid) { return (relations[nid] || 0) >= diff.loanReq && !wars[nid]; }

  function getNationInfo(nid) {
    var impacts = [];
    history.forEach(function(h) { if (h.choice.nations && h.choice.nations[nid]) impacts.push({ year: h.event.year, title: h.event.title.replace(" \u2605", ""), amount: applyStat(h.choice.nations[nid]) }); });
    if (loans[nid] && loans[nid] > 0) impacts.push({ year: evt ? evt.year : 0, title: "Loan (" + money(loans[nid]) + ")", amount: -Math.max(2, Math.round(loans[nid] * 0.15)), ongoing: true });
    if (repDrift !== 0) impacts.push({ year: 0, title: "Global rep drift (Intl: " + signed(stats.intl) + ")", amount: repDrift, ongoing: true });
    var hints = [];
    if (difficulty === "easy" || difficulty === "normal") {
      var v = relations[nid] || 0;
      if (v < -20) { hints.push("Choose options favoring this nation"); if (loans[nid] > 0) hints.push("Repay your loan to stop drain"); if (wars[nid]) hints.push("Wars are devastating \u2014 seek diplomacy"); hints.push("Raise International rep for passive rep recovery"); }
      else if (v < 10) { hints.push("A few friendly decisions could create an alliance"); }
      else { hints.push("Strong relations \u2014 available for loans"); }
    }
    return { impacts: impacts, hints: hints };
  }

  var allBroke = evt ? evt.choices.every(function(c) { return costOf(c) > gold; }) : false;
  var activeNat = evt ? getActiveNations(evt.year) : [];
  var loanableNat = activeNat.filter(function(n) { return canLoan(n.id); });
  var warCount = Object.keys(wars).filter(function(k) { return wars[k]; }).length;

  // Stat descriptions
  var domDesc = "Controls passive income: " + money(Math.round(expScale(stats.dom, 6) * diff.goldMult)) + "/turn";
  var intlDesc = "All nations drift " + signed(repDrift) + " rep/turn";
  var pwrDesc = "War costs reduced to " + Math.round(calcWarCostMult() * 100) + "%";

  var css = { "--bg": "#131210", "--card": "#1c1b17", "--border": "#2e2d28", "--text": "#e0d8c8", "--dim": "#8a8070", "--serif": "'Playfair Display', Georgia, serif", "--mono": "'DM Mono', 'Courier Prime', monospace", "--sans": "'DM Sans', sans-serif" };
  var base = Object.assign({}, css, { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--serif)" });
  var fonts = <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />;

  // Achievement popup
  var popupEl = achPopup ? (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 200, padding: "14px 24px", background: "rgba(91,117,83,0.95)", border: "1px solid rgba(91,117,83,0.6)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, animation: "fadeInDown 0.4s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <span style={{ fontSize: 28 }}>{achPopup.icon}</span>
      <div>
        <div style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#c8e0c0" }}>Achievement Unlocked!</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f0e8d8" }}>{achPopup.name}</div>
        <div style={{ fontSize: 11, fontFamily: "var(--sans)", color: "#b0d0a0" }}>{achPopup.desc}</div>
      </div>
    </div>
  ) : null;

  // ═══ TITLE ═══
  if (screen === "title") return (
    <div style={base}>{fonts}{popupEl}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(91,117,83,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 10, letterSpacing: 8, textTransform: "uppercase", color: "var(--dim)", fontFamily: "var(--mono)", marginBottom: 32 }}>A Foreign Policy Strategy Game</div>
        <h1 style={{ fontSize: "clamp(36px, 8vw, 64px)", fontWeight: 800, lineHeight: 1.05, margin: 0, letterSpacing: -2 }}>Commander</h1>
        <h1 style={{ fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 400, fontStyle: "italic", color: "var(--dim)", lineHeight: 1.2, margin: "4px 0 0 0" }}>in Chief</h1>
        <div style={{ width: 80, height: 2, background: "#5B7553", margin: "24px auto" }} />
        <p style={{ fontSize: 15, color: "var(--dim)", maxWidth: 440, lineHeight: 1.7, margin: "0 0 24px 0", fontFamily: "var(--sans)" }}>Manage your treasury, forge alliances, and shape the nation across 150 years.</p>
        <div style={{ marginBottom: 20, width: "100%", maxWidth: 300 }}>
          <label style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", display: "block", marginBottom: 6 }}>Your Presidential Name</label>
          <input value={nameInput} onChange={function(e) { setNameInput(e.target.value); }} placeholder="e.g. President Johnson" maxLength={30}
            style={{ width: "100%", padding: "10px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--serif)", fontSize: 16, textAlign: "center", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Btn onClick={function() { setPlayerName(nameInput || "Mr. President"); setScreen("settings"); }} style={{ background: "#5B7553", color: "#f0e8d8", padding: "14px 40px", letterSpacing: 3 }}>Begin</Btn>
          <Btn onClick={function() { setScreen("achievements"); }} style={{ background: "transparent", color: "var(--dim)", border: "1px solid var(--border)", padding: "14px 20px" }}>{"\u{1F3C6} Achievements"}</Btn>
        </div>
        <div style={{ marginTop: 20, fontSize: 11, color: "#5a5548", fontFamily: "var(--sans)", fontStyle: "italic" }}>Star events are bonus fun and won't be on your test.</div>
      </div>
    </div>
  );

  // ═══ ACHIEVEMENTS SCREEN ═══
  if (screen === "achievements") return (
    <div style={base}>{fonts}{popupEl}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 24px 0" }}>{"\u{1F3C6} Achievements"}</h2>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <AchievementPanel achievements={achievements} />
        </div>
        <Btn onClick={function() { setScreen("title"); }} style={{ marginTop: 24, background: "transparent", color: "var(--dim)", border: "1px solid var(--border)" }}>Back to Menu</Btn>
      </div>
    </div>
  );

  // ═══ SETTINGS ═══
  if (screen === "settings") return (
    <div style={base}>{fonts}{popupEl}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 28px 0" }}>Settings</h2>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", display: "block", marginBottom: 10 }}>Difficulty</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.keys(DIFF).map(function(key) { var d = DIFF[key]; var got = achievements["beat_" + key]; return (
                <button key={key} onClick={function() { setDifficulty(key); }} style={{ padding: "12px 14px", background: difficulty === key ? "rgba(91,117,83,0.2)" : "var(--card)", border: "1px solid " + (difficulty === key ? "#5B7553" : "var(--border)"), borderRadius: 6, cursor: "pointer", textAlign: "left", color: "var(--text)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 15, fontFamily: "var(--serif)", fontWeight: difficulty === key ? 700 : 400 }}>{d.label}</span>
                    {got && <span style={{ fontSize: 12 }}>{"\u2705"}</span>}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)", marginTop: 4 }}>{money(d.startGold)}{" | "}{d.punishMult}{"x pen | GO@"}{d.goThresh}</div>
                </button>
              ); })}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", display: "block", marginBottom: 8 }}>{"Events: "}{eventCount}</label>
            <input type="range" min={10} max={30} step={1} value={eventCount} onChange={function(e) { setEventCount(parseInt(e.target.value)); }} style={{ width: "100%", accentColor: "#5B7553" }} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Btn onClick={function() { setScreen("title"); }} style={{ flex: 1, background: "transparent", color: "var(--dim)", border: "1px solid var(--border)" }}>Back</Btn>
            <Btn onClick={function() { initGame(); setScreen("game"); }} style={{ flex: 2, background: "#5B7553", color: "#f0e8d8" }}>Start</Btn>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══ GAME OVER ═══
  if (screen === "game" && gameOver) {
    var isWin = gameOver === "victory";
    var score = Math.round((stats.dom + stats.intl + stats.pwr + 150) / 3);
    var grade = score >= 90 ? "S" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 45 ? "C" : score >= 30 ? "D" : "F";
    return (
      <div style={base}>{fonts}{popupEl}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 6, textTransform: "uppercase", color: isWin ? "#5B7553" : "#B54444", fontFamily: "var(--mono)", marginBottom: 12 }}>{isWin ? "Your Legacy" : "Presidency Ended"}</div>
          <div style={{ fontSize: 72, fontWeight: 800, color: grade === "S" ? "#DAA520" : grade === "F" ? "#B54444" : "var(--text)", lineHeight: 1 }}>{grade}</div>
          <div style={{ fontSize: 12, color: "var(--dim)", fontFamily: "var(--mono)", marginBottom: 16 }}>{playerName}{" | "}{score}{"/100 | "}{diff.label}</div>
          {!isWin && <p style={{ fontSize: 15, color: "#B54444", maxWidth: 400, lineHeight: 1.5, marginBottom: 16 }}>{gameOver}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16, width: "100%", maxWidth: 340 }}>
            {[{ l: "Dom", v: stats.dom, i: "\u{1F3DB}" }, { l: "Intl", v: stats.intl, i: "\u{1F30D}" }, { l: "Pwr", v: stats.pwr, i: "\u2694" }].map(function(s) { return (
              <div key={s.l} style={{ padding: 10, background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.v > 0 ? "#5B8C5A" : "#B54444" }}>{s.v}</div>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--dim)" }}>{s.i}{" "}{s.l}</div>
              </div>
            ); })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12, width: "100%", maxWidth: 340, fontSize: 12, fontFamily: "var(--sans)" }}>
            <div style={{ padding: 8, background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)" }}>{"💰 "}{money(gold)}</div>
            <div style={{ padding: 8, background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)" }}>{"📉 "}{money(spent)}{" spent"}</div>
          </div>
          {purchases.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginBottom: 12 }}>{purchases.map(function(p, i) { return <span key={i} style={{ padding: "3px 8px", background: "rgba(91,117,83,0.12)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)" }}>{p}</span>; })}</div>}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <Btn onClick={function() { setScreen("title"); setGameOver(null); }} style={{ background: "transparent", color: "var(--dim)", border: "1px solid var(--border)" }}>Menu</Btn>
            <Btn onClick={function() { setScreen("achievements"); }} style={{ background: "transparent", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)" }}>{"\u{1F3C6}"}</Btn>
            <Btn onClick={function() { initGame(); setGameOver(null); }} style={{ background: "#5B7553", color: "#f0e8d8" }}>Again</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ═══ MAIN GAME ═══
  if (screen === "game" && evt) {
    var tabS = function(k) { return { flex: 1, padding: "10px 8px", background: tab === k ? "var(--card)" : "transparent", border: "none", borderBottom: tab === k ? "2px solid " + era.color : "2px solid transparent", color: tab === k ? "var(--text)" : "var(--dim)", cursor: "pointer", fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 1 }; };

    return (
      <div style={base}>{fonts}{popupEl}
        {loanModal && <Modal onClose={function() { setLoanModal(null); }}>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#DAA520", marginBottom: 8 }}>Request Loan</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>{(NATIONS.find(function(n) { return n.id === loanModal; }) || {}).flag}{" "}{(NATIONS.find(function(n) { return n.id === loanModal; }) || {}).name}</div>
          <div style={{ fontSize: 11, color: "#B54444", fontFamily: "var(--sans)", marginBottom: 12 }}>{"Unpaid loans drain ~"}{Math.max(2, Math.round(loanAmt * 0.15))}{" rep/turn"}</div>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)" }}>{money(loanAmt)}</div>
          <input type="range" min={5} max={100} step={5} value={loanAmt} onChange={function(e) { setLoanAmt(parseInt(e.target.value)); }} style={{ width: "100%", accentColor: "#DAA520", margin: "8px 0" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn onClick={function() { setLoanModal(null); }} style={{ flex: 1, background: "transparent", color: "var(--dim)", border: "1px solid var(--border)" }}>Cancel</Btn>
            <Btn onClick={function() { takeLoan(loanModal, loanAmt); }} style={{ flex: 2, background: "#DAA520", color: "#1a1915", fontWeight: 700 }}>{"Take Loan"}</Btn>
          </div>
        </Modal>}
        {repayModal && <Modal onClose={function() { setRepayModal(null); }}>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#5B8C5A", marginBottom: 8 }}>Repay Loan</div>
          <div style={{ fontSize: 12, color: "var(--dim)", fontFamily: "var(--sans)", marginBottom: 8 }}>{"Owed: "}{money(loans[repayModal] || 0)}{" | Have: "}{money(gold)}</div>
          <input type="range" min={5} max={Math.min(gold, loans[repayModal] || 0)} step={5} value={Math.min(repayAmt, gold, loans[repayModal] || 0)} onChange={function(e) { setRepayAmt(parseInt(e.target.value)); }} style={{ width: "100%", accentColor: "#5B8C5A", margin: "8px 0" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn onClick={function() { setRepayModal(null); }} style={{ flex: 1, background: "transparent", color: "var(--dim)", border: "1px solid var(--border)" }}>Cancel</Btn>
            <Btn onClick={function() { repayLoan(repayModal, repayAmt); }} style={{ flex: 2, background: "#5B8C5A", color: "#f0e8d8", fontWeight: 700 }}>{"Repay "}{money(Math.min(repayAmt, gold, loans[repayModal] || 0))}</Btn>
          </div>
        </Modal>}

        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <button style={tabS("event")} onClick={function() { setTab("event"); }}>{"📜 Event"}</button>
            <button style={tabS("diplomacy")} onClick={function() { setTab("diplomacy"); }}>{"🤝 Diplomacy"}</button>
            <button style={tabS("profile")} onClick={function() { setTab("profile"); }}>{"👤 Profile"}</button>
          </div>
          <div style={{ padding: "8px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: era.color }}>{era.name}{" | "}{evt.year}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {warCount > 0 && <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#ff4444", fontWeight: 700 }}>{"\u2694"}{warCount}</span>}
                <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: gold < 20 ? "#B54444" : "#DAA520", fontWeight: 700 }}>{"💰"}{money(gold)}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: income >= 0 ? "#5B8C5A" : "#B54444" }}>{"("}{signedM(income)}{"/t)"}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <StatBar label="Dom" value={stats.dom} icon={"\u{1F3DB}"} color="#5B8C5A" warn={diff.goThresh} desc={domDesc} compact />
              <StatBar label="Intl" value={stats.intl} icon={"\u{1F30D}"} color="#4A7FB5" warn={diff.goThresh} desc={intlDesc} compact />
              <StatBar label="Pwr" value={stats.pwr} icon={"\u2694"} color="#B5854A" warn={diff.goThresh} desc={pwrDesc} compact />
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 12px 100px 12px", maxWidth: 560, margin: "0 auto" }}>
          {tab === "event" && (
            <div style={{ opacity: fadeIn ? 1 : 0, transform: fadeIn ? "translateY(0)" : "translateY(10px)", transition: "all 0.25s ease" }}>
              {warCount > 0 && <div style={{ padding: "8px 12px", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, marginBottom: 10, fontSize: 12, fontFamily: "var(--sans)", color: "#ff6666" }}>
                {"\u2694 At war! Costs reduced to "}{Math.round(calcWarCostMult() * 100)}{"% by Power"}
              </div>}
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)", textTransform: "uppercase", letterSpacing: 2 }}>{"Event "}{idx + 1}{"/"}{gameEvents.length}{evt.duration === "long" ? " | 10-20yr" : evt.duration === "short" ? " | 1-5yr" : ""}</span>
              </div>
              <h2 style={{ textAlign: "center", fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 700, margin: "8px 0", lineHeight: 1.2 }}>{evt.title}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, textAlign: "center", margin: "8px 0 16px 0", fontFamily: "var(--sans)" }}>{evt.desc}</p>

              {!result ? (
                <div>
                  {allBroke && (
                    <div style={{ padding: "12px 16px", background: "rgba(218,165,32,0.1)", border: "1px solid rgba(218,165,32,0.3)", borderRadius: 6, marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#DAA520", marginBottom: 6 }}>Treasury Empty</div>
                      {loanableNat.length > 0 ? (
                        <div>
                          <div style={{ fontSize: 12, fontFamily: "var(--sans)", marginBottom: 6 }}>Request a loan from a friendly nation:</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {loanableNat.map(function(n) { return <button key={n.id} onClick={function() { setLoanModal(n.id); setLoanAmt(20); }} style={{ padding: "6px 12px", background: "rgba(218,165,32,0.15)", border: "1px solid rgba(218,165,32,0.4)", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "var(--sans)", color: "var(--text)" }}>{n.flag}{" "}{n.name}</button>; })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, color: "#B54444", fontFamily: "var(--sans)", marginBottom: 8 }}>{"No nation has +"}{diff.loanReq}{" rep. Face the consequences."}</div>
                          <button onClick={faceConsequences} style={{ width: "100%", padding: 14, fontSize: 13, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, background: "rgba(181,68,68,0.15)", color: "#ff6666", border: "1px solid rgba(181,68,68,0.4)", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>{"💀 Face the Consequences"}</button>
                          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#B54444", marginTop: 4, textAlign: "center" }}>{"\u{1F3DB}"}{Math.round(-10 * diff.punishMult)}{" | \u{1F30D}"}{Math.round(-8 * diff.punishMult)}{" | \u2694"}{Math.round(-6 * diff.punishMult)}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {evt.choices.map(function(c, i) {
                      var cost = costOf(c); var ok = cost <= gold;
                      return (
                        <button key={i} onClick={function() { if (ok) applyChoice(c); }} disabled={!ok} style={{ padding: "14px 16px", background: ok ? "var(--card)" : "rgba(28,27,23,0.5)", border: "1px solid " + (ok ? "var(--border)" : "#2a2920"), borderRadius: 6, color: ok ? "var(--text)" : "#5a5548", fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.5, textAlign: "left", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.5 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div><span style={{ color: era.color, fontWeight: 700, marginRight: 6, fontFamily: "var(--serif)" }}>{["I.", "II.", "III."][i]}</span>{c.text}</div>
                            {cost > 0 && <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: ok ? "#DAA520" : "#B54444", whiteSpace: "nowrap", fontWeight: 700 }}>{money(cost)}</span>}
                          </div>
                          {!ok && <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#B54444", marginTop: 4 }}>{"Short "}{money(cost - gold)}</div>}
                          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, fontFamily: "var(--mono)", flexWrap: "wrap" }}>
                            {c.dom !== 0 && <span style={{ color: c.dom > 0 ? "#5B8C5A" : "#B54444" }}>{"\u{1F3DB}"}{signed(c.dom)}</span>}
                            {c.intl !== 0 && <span style={{ color: c.intl > 0 ? "#5B8C5A" : "#B54444" }}>{"\u{1F30D}"}{signed(c.intl)}</span>}
                            {c.pwr !== 0 && <span style={{ color: c.pwr > 0 ? "#5B8C5A" : "#B54444" }}>{"\u2694"}{signed(c.pwr)}</span>}
                            {(c.gold || 0) > 0 && <span style={{ color: "#DAA520" }}>{"💰+"}{c.gold}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ padding: "12px 16px", background: result.isFaceConsequences ? "rgba(181,68,68,0.08)" : "rgba(91,117,83,0.1)", border: "1px solid " + (result.isFaceConsequences ? "rgba(181,68,68,0.3)" : "rgba(91,117,83,0.3)"), borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: result.isFaceConsequences ? "#B54444" : "#5B7553", fontFamily: "var(--mono)", marginBottom: 4 }}>{result.isFaceConsequences ? "Consequences" : "Your Decision"}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, fontFamily: "var(--sans)" }}>{result.text}</div>
                  </div>
                  <div style={{ padding: "12px 16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, fontFamily: "var(--mono)" }}>
                      {result.dom !== 0 && <span style={{ color: result.dom > 0 ? "#5B8C5A" : "#B54444" }}>{"\u{1F3DB}"}{applyStat(result.dom)}</span>}
                      {result.intl !== 0 && <span style={{ color: result.intl > 0 ? "#5B8C5A" : "#B54444" }}>{"\u{1F30D}"}{applyStat(result.intl)}</span>}
                      {result.pwr !== 0 && <span style={{ color: result.pwr > 0 ? "#5B8C5A" : "#B54444" }}>{"\u2694"}{applyStat(result.pwr)}</span>}
                      {result.actualCost > 0 && <span style={{ color: "#B54444" }}>{"💰-"}{money(result.actualCost)}</span>}
                      {result.purchase && <span style={{ color: "#DAA520" }}>{"🗺 "}{result.purchase}</span>}
                    </div>
                    {result.nations && Object.keys(result.nations).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {Object.keys(result.nations).map(function(nid) { var nat = NATIONS.find(function(n) { return n.id === nid; }); if (!nat) return null; var v = applyStat(result.nations[nid]); return <span key={nid} style={{ fontSize: 10, fontFamily: "var(--mono)", color: v > 0 ? "#5B8C5A" : "#B54444" }}>{nat.flag}{signed(v)}</span>; })}
                    </div>}
                  </div>
                  {showTerm && <div style={{ margin: "10px 0", padding: "12px 16px", background: evt.termDef.startsWith("\u2605") ? "rgba(218,165,32,0.06)" : "rgba(91,117,83,0.06)", border: "1px solid " + (evt.termDef.startsWith("\u2605") ? "rgba(218,165,32,0.25)" : "rgba(91,117,83,0.25)"), borderRadius: 6, fontSize: 13, lineHeight: 1.6, fontFamily: "var(--sans)" }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: evt.termDef.startsWith("\u2605") ? "#DAA520" : "#5B7553", fontFamily: "var(--mono)", marginBottom: 4 }}>{evt.termDef.startsWith("\u2605") ? "Bonus" : "📖 Term to Know"}</div>
                    {evt.termDef}
                  </div>}
                  <Btn onClick={nextEvent} style={{ width: "100%", marginTop: 8, background: era.color, color: "#f0e8d8" }}>
                    {idx + 1 >= gameEvents.length ? "See Legacy \u2192" : "Next \u2192 (+" + money(income) + ")"}
                  </Btn>
                </div>
              )}
            </div>
          )}

          {tab === "diplomacy" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 4px 0" }}>World Relations</h3>
                <p style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--mono)" }}>{activeNat.length}{" nations | Rep drift: "}{signed(repDrift)}{"/turn"}</p>
                <p style={{ fontSize: 10, color: "#5a5548", fontFamily: "var(--sans)", fontStyle: "italic" }}>{"Tap nations for details"}{(difficulty === "easy" || difficulty === "normal") ? " + tips" : ""}</p>
              </div>
              {Object.keys(loans).filter(function(k) { return loans[k] > 0; }).length > 0 && (
                <div style={{ padding: "10px 14px", background: "rgba(218,165,32,0.08)", border: "1px solid rgba(218,165,32,0.25)", borderRadius: 6, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#DAA520", marginBottom: 6 }}>Loans</div>
                  {Object.keys(loans).filter(function(k) { return loans[k] > 0; }).map(function(nid) {
                    var n = NATIONS.find(function(nn) { return nn.id === nid; }); if (!n) return null;
                    return <div key={nid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontFamily: "var(--sans)" }}>{n.flag}{" "}{n.name}{": "}{money(loans[nid])}</span>
                      {gold >= 5 && <Btn onClick={function() { setRepayModal(nid); setRepayAmt(Math.min(10, gold, loans[nid])); }} style={{ padding: "3px 10px", fontSize: 10, background: "#5B8C5A", color: "#f0e8d8" }}>Repay</Btn>}
                    </div>;
                  })}
                </div>
              )}
              {activeNat.map(function(n) {
                var v = relations[n.id] || 0; var atW = !!wars[n.id]; var hasL = (loans[n.id] || 0) > 0; var isE = !!expNation[n.id]; var info = getNationInfo(n.id);
                var col = atW ? "#ff4444" : v > 20 ? "#5B8C5A" : v > 0 ? "#7A9A6A" : v > -10 ? "#B5854A" : "#B54444";
                var lab = atW ? "AT WAR" : v > 30 ? "Allied" : v > 10 ? "Friendly" : v > -10 ? "Neutral" : v > -30 ? "Tense" : "Hostile";
                return (
                  <div key={n.id} style={{ marginBottom: 2 }}>
                    <div onClick={function() { setExpNation(function(p) { var o = Object.assign({}, p); o[n.id] = !o[n.id]; return o; }); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: atW ? "rgba(255,68,68,0.08)" : "#1c1b17", border: "1px solid " + (atW ? "rgba(255,68,68,0.3)" : "#2e2d28"), borderRadius: isE ? "6px 6px 0 0" : 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{n.flag}</span>
                        <div><span style={{ fontSize: 13, fontFamily: "var(--serif)" }}>{n.name}</span>{hasL && <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#DAA520" }}>{"Owe "}{money(loans[n.id])}</div>}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: col, fontWeight: atW ? 700 : 400 }}>{lab}</span>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: col, fontWeight: 700 }}>{signed(v)}</span>
                        <span style={{ fontSize: 10, color: "var(--dim)", transform: isE ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>{"\u25BC"}</span>
                      </div>
                    </div>
                    {isE && <div style={{ padding: "10px 14px", background: "rgba(30,29,24,0.8)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", marginBottom: 4 }}>
                      {info.impacts.length > 0 ? <div style={{ marginBottom: info.hints.length > 0 ? 8 : 0 }}>
                        <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 4 }}>{"Rep breakdown"}</div>
                        {info.impacts.map(function(imp, ix) { return <div key={ix} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11, fontFamily: "var(--sans)" }}>
                          <span>{imp.ongoing ? "🔄 " : ""}{imp.title}</span>
                          <span style={{ fontFamily: "var(--mono)", color: imp.amount > 0 ? "#5B8C5A" : "#B54444", fontWeight: 700 }}>{signed(imp.amount)}{imp.ongoing ? "/t" : ""}</span>
                        </div>; })}
                      </div> : <div style={{ fontSize: 11, color: "var(--dim)", fontStyle: "italic", marginBottom: 4 }}>{"No impacts yet"}</div>}
                      {info.hints.length > 0 && <div>{info.hints.map(function(h, hx) { return <div key={hx} style={{ fontSize: 11, fontFamily: "var(--sans)", color: "#8ab4d6", lineHeight: 1.4, paddingLeft: 8, borderLeft: "2px solid rgba(74,127,181,0.3)", marginBottom: 3 }}>{h}</div>; })}</div>}
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        {canLoan(n.id) && !atW && <Btn onClick={function() { setLoanModal(n.id); setLoanAmt(20); }} style={{ padding: "4px 10px", fontSize: 9, background: "rgba(218,165,32,0.15)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.3)" }}>Loan</Btn>}
                        {hasL && gold >= 5 && <Btn onClick={function() { setRepayModal(n.id); setRepayAmt(Math.min(10, gold, loans[n.id])); }} style={{ padding: "4px 10px", fontSize: 9, background: "rgba(91,140,90,0.15)", color: "#5B8C5A", border: "1px solid rgba(91,140,90,0.3)" }}>Repay</Btn>}
                      </div>
                    </div>}
                    {!isE && <div style={{ display: "flex", gap: 6, marginBottom: 4, marginLeft: 30 }}>
                      {canLoan(n.id) && !atW && <Btn onClick={function() { setLoanModal(n.id); setLoanAmt(20); }} style={{ padding: "2px 8px", fontSize: 9, background: "rgba(218,165,32,0.1)", color: "#DAA520", border: "1px solid rgba(218,165,32,0.2)" }}>Loan</Btn>}
                      {hasL && gold >= 5 && <Btn onClick={function() { setRepayModal(n.id); setRepayAmt(Math.min(10, gold, loans[n.id])); }} style={{ padding: "2px 8px", fontSize: 9, background: "rgba(91,140,90,0.1)", color: "#5B8C5A", border: "1px solid rgba(91,140,90,0.2)" }}>Repay</Btn>}
                    </div>}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "profile" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 6 }}>{"\u{1F3A9}"}</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{playerName}</h3>
                <p style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)" }}>{diff.label}{" | "}{evt.year}</p>
              </div>
              <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 8 }}>Treasury</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontFamily: "var(--sans)", fontSize: 12 }}>
                  <div>{"💰 "}{money(gold)}</div><div>{"📈 Earned: "}{money(earned)}</div>
                  <div>{"📉 Spent: "}{money(spent)}</div><div>{"📊 Income: "}{signedM(income)}{"/t"}</div>
                </div>
              </div>
              <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 8 }}>Stats (max {"\u00B1"}{STAT_MAX})</div>
                <StatBar label="Domestic" value={stats.dom} icon={"\u{1F3DB}"} color="#5B8C5A" warn={diff.goThresh} desc={domDesc} />
                <StatBar label="International" value={stats.intl} icon={"\u{1F30D}"} color="#4A7FB5" warn={diff.goThresh} desc={intlDesc} />
                <StatBar label="Power" value={stats.pwr} icon={"\u2694"} color="#B5854A" warn={diff.goThresh} desc={pwrDesc} />
              </div>
              {purchases.length > 0 && <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 6 }}>Territories</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{purchases.map(function(p, i) { return <span key={i} style={{ padding: "3px 8px", background: "rgba(91,117,83,0.12)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)" }}>{p}</span>; })}</div>
              </div>}
              {policies.length > 0 && <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 6 }}>Policies</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{policies.map(function(p, i) { return <span key={i} style={{ padding: "3px 8px", background: "rgba(74,127,181,0.12)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)" }}>{p}</span>; })}</div>
              </div>}
              <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "var(--dim)", marginBottom: 6 }}>{"History ("}{history.length}{")"}</div>
                <div style={{ maxHeight: 250, overflow: "auto" }}>
                  {history.map(function(h, i) {
                    var isE2 = !!expHistory[i]; var isBon = h.event.termDef.startsWith("\u2605");
                    return <div key={i} style={{ borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <button onClick={function() { setExpHistory(function(p) { var o = Object.assign({}, p); o[i] = !o[i]; return o; }); }} style={{ width: "100%", padding: "6px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontFamily: "var(--sans)" }}><span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", marginRight: 4 }}>{h.event.year}</span><strong>{h.event.title.replace(" \u2605", "")}</strong>{isBon && <span style={{ color: "#DAA520", marginLeft: 3 }}>{"\u2605"}</span>}</span>
                        <span style={{ fontSize: 10, color: "var(--dim)", transform: isE2 ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>{"\u25BC"}</span>
                      </button>
                      {isE2 && <div style={{ padding: "6px 10px 10px", background: isBon ? "rgba(218,165,32,0.04)" : "rgba(91,117,83,0.04)", borderRadius: 4, fontSize: 12, fontFamily: "var(--sans)", lineHeight: 1.5 }}>
                        <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: isBon ? "#DAA520" : "#5B7553", marginBottom: 3 }}>{isBon ? "Bonus" : "📖 Definition"}</div>
                        <div style={{ marginBottom: 4 }}>{h.event.termDef}</div>
                        <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)" }}>{"Choice: "}{(h.choice.text || "").substring(0, 55)}{(h.choice.text || "").length > 55 ? "..." : ""}</div>
                      </div>}
                    </div>;
                  })}
                  {history.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", fontStyle: "italic" }}>No decisions yet</div>}
                </div>
              </div>
              <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
                <AchievementPanel achievements={achievements} />
              </div>
              <div style={{ padding: 14, background: "rgba(181,68,68,0.06)", border: "1px solid rgba(181,68,68,0.2)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 2, color: "#B54444", marginBottom: 6 }}>Danger Zone</div>
                <Btn onClick={function() { checkEndGameAchievements(); setGameOver("victory"); }} style={{ width: "100%", background: "rgba(181,68,68,0.15)", color: "#ff6666", border: "1px solid rgba(181,68,68,0.3)", fontWeight: 700 }}>{"Abandon Run"}</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
