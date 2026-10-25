/** Official nutrition pages for chains common in the GTA, matched on the restaurant name. */
const LINKS: [RegExp, string, string][] = [
  [/nando/i, "Nando's Canada nutrition", "https://www.nandos.ca/nutrition"],
  [/popeyes/i, "Popeyes Canada nutrition", "https://www.popeyeschicken.ca/nutrition"],
  [/subway/i, "Subway Canada nutrition", "https://www.subway.com/en-CA/MenuNutrition/Nutrition"],
  [/mcdonald/i, "McDonald's Canada nutrition", "https://www.mcdonalds.com/ca/en-ca/about-our-food/nutrition-calculator.html"],
  [/a&amp;w|a&w\b/i, "A&W Canada nutrition", "https://web.aw.ca/en/our-menu/nutrition"],
  [/burger king/i, "Burger King Canada nutrition", "https://www.burgerking.ca/nutrition"],
  [/wendy/i, "Wendy's Canada nutrition", "https://www.wendys.com/en-ca/nutrition"],
  [/tim hortons/i, "Tim Hortons nutrition", "https://www.timhortons.ca/nutrition-and-wellness"],
  [/pizza pizza/i, "Pizza Pizza nutrition", "https://www.pizzapizza.ca/nutrition"],
  [/pizza hut/i, "Pizza Hut Canada nutrition", "https://www.pizzahut.ca/nutrition"],
  [/domino/i, "Domino's Canada nutrition", "https://www.dominos.ca/en/pages/content/nutritional/"],
  [/chipotle/i, "Chipotle nutrition calculator", "https://www.chipotle.ca/nutrition-calculator"],
  [/freshii/i, "Freshii nutrition", "https://www.freshii.com/ca/en-ca/nutrition"],
  [/jack astor/i, "Jack Astor's nutrition", "https://www.jackastors.com/en/nutrition"],
  [/osmow/i, "Osmow's nutrition", "https://osmows.com/nutrition/"],
  [/halal guys/i, "The Halal Guys nutrition", "https://thehalalguys.com/nutrition/"],
  [/wingstop/i, "Wingstop nutrition", "https://www.wingstop.com/nutrition"],
  [/kfc/i, "KFC Canada nutrition", "https://www.kfc.ca/nutrition"],
  [/church'?s/i, "Church's Texas Chicken nutrition", "https://www.churchs.ca/nutrition"],
  [/starbucks/i, "Starbucks Canada nutrition", "https://www.starbucks.ca/menu"],
  [/swiss chalet/i, "Swiss Chalet nutrition", "https://www.swisschalet.com/en/nutrition"],
  [/harvey/i, "Harvey's nutrition", "https://www.harveys.ca/en/nutrition"],
  [/mary brown/i, "Mary Brown's nutrition", "https://marybrowns.com/nutrition/"],
  [/panera/i, "Panera nutrition", "https://www.panerabread.com/en-us/nutrition.html"],
  [/five guys/i, "Five Guys nutrition", "https://www.fiveguys.ca/nutrition"],
  [/shawarma|lazeez/i, "", ""],
];

export function officialNutritionLink(restaurant: string): { label: string; url: string } | null {
  for (const [re, label, url] of LINKS) {
    if (re.test(restaurant)) return url ? { label, url } : null;
  }
  return null;
}
