// The KIROS FarmShop menu, from "KIROS FarmShop — Menu Ordering User Stories.md" (menu notes taken at the shop on
// 14 Nov 2026). Used by `npm run seed` (fresh database) and `npm run seed:farmshop` (adds it to an existing one).
//
// PRICES ARE PLACEHOLDERS. The notes record no prices; every price here must be confirmed and set in
// Admin → Menus / Option groups before go-live. Items the notes leave incomplete (a missing name, dressing,
// recipe or rule) are created hidden, so nothing half-guessed reaches customers: switch them on once confirmed.
import { MenuRepository } from "../modules/menu/repositories/menu.repository";

const K = (naira: number) => naira * 100;

interface GroupSpec {
  name: string;
  minSelect: number;
  maxSelect: number;
  helpText: string | null;
  options: Array<[string, number]>;
}

// Build-your-own salad: Base → Fillings → Cravings → Dressing → Protein (the order the customer sees them).
const SALAD_GROUPS: GroupSpec[] = [
  { name: "Base", minSelect: 1, maxSelect: 1, helpText: null, options: [["White cabbage", 0], ["Lettuce", 0], ["Kale", 0]] },
  {
    name: "Fillings",
    minSelect: 1,
    maxSelect: 10,
    helpText: null,
    options: [
      "Purple cabbage", "Rocket", "Cucumber", "Carrot", "Beetroot", "Chickpeas", "Pickled onions", "Bell peppers", "Tomatoes", "Broccoli", "Cauliflower", "Apple",
      "Coconut shavings", "Kidney beans", "Cashew nuts", "Pumpkin seeds", "Sesame seeds", "Almond nuts", "Hazelnuts", "Chia seeds", "Egg", "Green lentils", "Croutons",
    ].map((n) => [n, 0] as [string, number]),
  },
  {
    name: "Cravings",
    minSelect: 2,
    maxSelect: 2,
    helpText: null,
    options: ["Quinoa", "Green olives", "Black olives", "Red grapes", "Pomegranate", "Mozzarella cheese", "Parmesan cheese", "Macaroni", "Avocado", "Cherry tomatoes", "Radish"].map((n) => [n, 0] as [string, number]),
  },
  {
    name: "Dressing",
    minSelect: 1,
    maxSelect: 1,
    helpText: null,
    options: ["Lime vinaigrette", "Cilantro vinaigrette", "Garlic cider vinaigrette", "Balsamic vinaigrette", "House dressing", "KIROS special dressing"].map((n) => [n, 0] as [string, number]),
  },
  {
    name: "Protein add-on",
    minSelect: 0,
    maxSelect: 1,
    helpText: "Add one protein for an extra charge.",
    options: [["Shrimp", K(2500)], ["Chicken", K(2000)], ["Beef", K(2000)], ["Turkey", K(2500)], ["Gizzard", K(1500)], ["Fish", K(2000)], ["Bacon", K(2000)]],
  },
];

const PARFAIT_SIZE: GroupSpec = { name: "Parfait size", minSelect: 1, maxSelect: 1, helpText: null, options: [["Medium", 0], ["Big", K(1500)]] };

interface ItemSpec {
  name: string;
  price: number;
  description: string;
  featured?: boolean;
  /** False keeps it off the storefront until the open question about it is answered. */
  active?: boolean;
  groups?: string[];
}

interface CategorySpec {
  name: string;
  description: string | null;
  items: ItemSpec[];
}

const CATEGORIES: CategorySpec[] = [
  {
    name: "Build your own salad",
    description: "Pick a base, up to 10 fillings, 2 cravings and a dressing. Add a protein if you like.",
    items: [{ name: "Build Your Salad", price: K(5000), description: "Your salad, your way: one base, up to 10 fillings, 2 cravings and your choice of dressing.", featured: true, groups: SALAD_GROUPS.map((g) => g.name) }],
  },
  {
    name: "Signature salads",
    description: "Our favourite combinations, ready to order.",
    items: [
      { name: "Garden salad", price: K(6500), description: "Dressed with lime vinaigrette.", featured: true },
      { name: "Purple rain salad", price: K(6500), description: "Dressed with cilantro vinaigrette." },
      { name: "Kale crunch", price: K(6500), description: "Dressed with garlic cider vinaigrette." },
      { name: "Chunky greek salad", price: K(6500), description: "Dressed with balsamic vinaigrette." },
      { name: "Chicken salad", price: K(8000), description: "With chicken, dressed with house dressing.", featured: true },
      // Open question: which dressing?
      { name: "Avocado chicken salad", price: K(8500), description: "With chicken and avocado.", active: false },
    ],
  },
  {
    name: "Shawarma, wraps & sandwiches",
    description: null,
    items: [
      { name: "Beef shawarma", price: K(5000), description: "Beef shawarma." },
      { name: "Chicken shawarma", price: K(4500), description: "Chicken shawarma.", featured: true },
      { name: "Mixed grill shawarma", price: K(5500), description: "Mixed grill shawarma." },
      { name: "Chicken wrap", price: K(4500), description: "Chicken wrap." },
      { name: "Chicken sandwich", price: K(4000), description: "Cucumber, lettuce, avocado, tomatoes, onions, oregano and sesame seed." },
      // Open question: what's in it?
      { name: "Exclusive sandwich", price: K(5000), description: "Ingredients to be confirmed.", active: false },
    ],
  },
  {
    name: "Smoothies",
    description: null,
    items: [
      { name: "Epic", price: K(4000), description: "Spinach, banana, honey and moringa." },
      { name: "Vintage", price: K(4000), description: "Cucumber, pawpaw, kale, mint leaf and honey." },
      { name: "Sunny Hawaii", price: K(4000), description: "Banana, coconut water, mango and vanilla extract." },
      { name: "Very Berry", price: K(4500), description: "Strawberry, banana, blueberry, grape, coconut milk and honey.", featured: true },
      { name: "Sweet Melon", price: K(4000), description: "Sweet melon, cucumber, mint leaf and banana." },
      { name: "Blueray", price: K(4500), description: "Blueberry, strawberry, banana, Greek yoghurt, sesame seed and honey." },
      // Open questions: these four have no confirmed name (and one no recipe). Rename and switch on in admin.
      { name: "Banana oat smoothie (name to confirm)", price: K(4000), description: "Yoghurt, oats, banana, honey, vanilla extract and cinnamon.", active: false },
      { name: "High protein smoothie (name to confirm)", price: K(5000), description: "Banana, blueberries, oats, yoghurt, peanut butter, honey, almond milk and protein powder.", active: false },
      { name: "Unnamed smoothie 1", price: K(4000), description: "Recipe to be confirmed.", active: false },
      { name: "Berry chia smoothie (name to confirm)", price: K(4500), description: "Strawberry, Greek yoghurt, mixed berries, chia seed and almond milk.", active: false },
    ],
  },
  {
    name: "Parfait",
    description: null,
    // Open question: are the toppings fixed or picked like salad fillings? Hidden until confirmed.
    items: [{ name: "Parfait", price: K(3500), description: "Yoghurt, granola, walnuts, cashew nut, coconut, raisin and fresh fruit: blueberry, kiwi, strawberry, grapes, apple and pomegranate.", active: false, groups: [PARFAIT_SIZE.name] }],
  },
  {
    name: "Juice blends",
    description: "Natural juice blends, pressed fresh.",
    items: [
      { name: "My Skin", price: K(3500), description: "Carrot, pineapple, ginger, turmeric and orange.", featured: true },
      { name: "Imperial", price: K(3500), description: "Sweet melon, pineapple, watermelon and beetroot." },
      { name: "Vitamin C", price: K(3500), description: "Pineapple, sweet melon, yellow bell pepper and ginger." },
      { name: "Refuel", price: K(3500), description: "Pineapple, cucumber and beetroot." },
      { name: "Immune Hero", price: K(3500), description: "Pineapple, orange, cucumber, lime, ginger and lemongrass." },
      { name: "Sea Breeze", price: K(3500), description: "Carrot, coconut, clove, ginger and date." },
      { name: "Mixed Juice", price: K(3500), description: "Pineapple, orange, watermelon, carrot and ginger." },
    ],
  },
  {
    name: "Fresh juices",
    description: "Single-fruit juices.",
    items: [
      { name: "Orange juice", price: K(3000), description: "Freshly pressed orange." },
      { name: "Pineapple juice", price: K(3000), description: "Freshly pressed pineapple." },
      { name: "Watermelon juice", price: K(3000), description: "Freshly pressed watermelon." },
    ],
  },
];

export const FARMSHOP_MENU_NAME = "FarmShop Menu";

/** Creates the FarmShop menu (categories, option groups, items) for an organization and returns the menu id. */
export async function installFarmshopMenu(organizationId: string, sortOrder = 0): Promise<{ menuId: string; itemCount: number; hiddenItems: string[] }> {
  const menus = MenuRepository.Instance;
  const menu = await menus.createMenu({
    organizationId,
    name: FARMSHOP_MENU_NAME,
    description: "Build-your-own salads, signature salads, shawarma, smoothies, parfait and fresh juices.",
    imageUrl: null,
    imagePublicId: null,
    sortOrder,
    isActive: true,
  });

  const groupIds: Record<string, string> = {};
  const groups = [...SALAD_GROUPS, PARFAIT_SIZE];
  for (let gi = 0; gi < groups.length; gi++) {
    const spec = groups[gi];
    const g = await menus.createGroup({ organizationId, name: spec.name, helpText: spec.helpText, minSelect: spec.minSelect, maxSelect: spec.maxSelect, sortOrder: gi });
    for (let i = 0; i < spec.options.length; i++) {
      await menus.createOption({ organizationId, groupId: g.id, name: spec.options[i][0], priceDelta: spec.options[i][1], isActive: true, sortOrder: i });
    }
    groupIds[spec.name] = g.id;
  }

  let itemCount = 0;
  const hiddenItems: string[] = [];
  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const c = CATEGORIES[ci];
    const category = await menus.createCategory({ organizationId, menuId: menu.id, name: c.name, description: c.description, imageUrl: null, imagePublicId: null, sortOrder: ci });
    for (let ii = 0; ii < c.items.length; ii++) {
      const it = c.items[ii];
      const active = it.active ?? true;
      const created = await menus.createItem({
        organizationId,
        categoryId: category.id,
        name: it.name,
        description: it.description,
        basePrice: it.price,
        imageUrl: null,
        imagePublicId: null,
        photos: [],
        isFeatured: Boolean(it.featured),
        isActive: active,
        sortOrder: ii,
      });
      if (it.groups?.length) await menus.setItemGroups(created.id, it.groups.map((n) => groupIds[n]));
      itemCount++;
      if (!active) hiddenItems.push(it.name);
    }
  }
  return { menuId: menu.id, itemCount, hiddenItems };
}
