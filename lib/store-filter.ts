/** Stores that are not restaurants: grocery, convenience, pharmacy, retail, alcohol, cannabis, pet, flowers. */
const NON_RESTAURANT_NAME =
  /\b(costco|walmart|loblaws?|no frills|nofrills|sobeys|metro|food basics|freshco|longo'?s|farm boy|t&t|whole foods|fortinos|zehrs|real canadian superstore|superstore|shoppers drug|rexall|pharma|pharmacy|dollarama|dollar tree|lcbo|beer store|wine rack|convenience|grocery|groceries|supermarket|wal-?mart|mini ?mart|food ?mart|\w+ mart|7-eleven|circle k|hasty market|rabba|petro-?canada|esso|shell|canadian tire|best buy|staples|pet ?smart|pet valu|florist|flower shop|flower delivery|cannabis|dispensary|vape|smoke shop|liquor|wholesale|depot|hardware|variety store|snacks & sodas|bulk barn|dollar store)\b/i;

const NON_RESTAURANT_TYPES = new Set(["GroceryStore", "ConvenienceStore", "Store", "Pharmacy", "LiquorStore", "Florist", "PetStore", "HardwareStore", "DepartmentStore", "WholesaleStore"]);

export function isNonRestaurantName(name: string): boolean {
  return NON_RESTAURANT_NAME.test(name) || /^view store$/i.test(name.trim());
}

export function isNonRestaurantType(type: string | null | undefined): boolean {
  return Boolean(type && NON_RESTAURANT_TYPES.has(type));
}
