import { actorOf, handle, input } from "../../../shared/http/handler";
import { requireFile, requireFiles } from "../../../shared/middleware/upload.middleware";
import { OrganizationService } from "../../organization/services/organization.service";
import { MenuService } from "../services/menu.service";
import { StorefrontMenuService } from "../services/storefrontMenu.service";
import {
  createCategorySchema,
  createGroupSchema,
  createItemSchema,
  createMenuSchema,
  createOptionSchema,
  listCategoriesSchema,
  itemPhotoSchema,
  listItemsSchema,
  menuIdSchema,
  optionIdSchema,
  reorderPhotosSchema,
  reorderSchema,
  storeFeaturedSchema,
  storeItemSchema,
  storeMenuSchema,
  storeMenusSchema,
  storeSearchSchema,
  updateCategorySchema,
  updateGroupSchema,
  updateItemSchema,
  updateMenuSchema,
  updateOptionSchema,
} from "../validators/menu.schema";

const svc = () => MenuService.Instance;
const store = (slug: string) => OrganizationService.Instance.resolveStore(slug);
const id = (req: Parameters<typeof input>[0]) => input(req, menuIdSchema).params.id;

export class MenuController {
  // Menus
  static listMenus = handle("Menus fetched", (req) => svc().listMenus(actorOf(req)));
  static createMenu = handle("Menu created", (req) => svc().createMenu(actorOf(req), input(req, createMenuSchema).body), 201);
  static updateMenu = handle("Menu updated", (req) => {
    const { params, body } = input(req, updateMenuSchema);
    return svc().updateMenu(actorOf(req), params.id, body);
  });
  static deleteMenu = handle("Menu deleted", (req) => svc().deleteMenu(actorOf(req), id(req)));
  static uploadMenuImage = handle("Menu image updated", (req) => svc().uploadMenuImage(actorOf(req), id(req), requireFile(req).buffer));
  static reorderMenus = handle("Menus reordered", (req) => svc().reorderMenus(actorOf(req), input(req, reorderSchema).body.ids));

  // Categories
  static listCategories = handle("Categories fetched", (req) => svc().listCategories(actorOf(req), input(req, listCategoriesSchema).query.menuId));
  static createCategory = handle("Category created", (req) => svc().createCategory(actorOf(req), input(req, createCategorySchema).body), 201);
  static updateCategory = handle("Category updated", (req) => {
    const { params, body } = input(req, updateCategorySchema);
    return svc().updateCategory(actorOf(req), params.id, body);
  });
  static deleteCategory = handle("Category deleted", (req) => svc().deleteCategory(actorOf(req), id(req)));
  static uploadCategoryImage = handle("Category image updated", (req) => svc().uploadCategoryImage(actorOf(req), id(req), requireFile(req).buffer));
  static reorderCategories = handle("Categories reordered", (req) => svc().reorderCategories(actorOf(req), input(req, reorderSchema).body.ids));

  // Items
  static listItems = handle("Items fetched", (req) => svc().listItems(actorOf(req), input(req, listItemsSchema).query));
  static getItem = handle("Item fetched", (req) => svc().getItem(actorOf(req), id(req)));
  static createItem = handle("Item created", (req) => svc().createItem(actorOf(req), input(req, createItemSchema).body), 201);
  static updateItem = handle("Item updated", (req) => {
    const { params, body } = input(req, updateItemSchema);
    return svc().updateItem(actorOf(req), params.id, body);
  });
  static deleteItem = handle("Item deleted", (req) => svc().deleteItem(actorOf(req), id(req)));
  static addItemPhotos = handle("Photos added", (req) => svc().addItemPhotos(actorOf(req), id(req), requireFiles(req).map((f) => f.buffer)));
  static removeItemPhoto = handle("Photo removed", (req) => {
    const { params } = input(req, itemPhotoSchema);
    return svc().removeItemPhoto(actorOf(req), params.id, params.photoId);
  });
  static reorderItemPhotos = handle("Photos reordered", (req) => {
    const { params, body } = input(req, reorderPhotosSchema);
    return svc().reorderItemPhotos(actorOf(req), params.id, body.ids);
  });
  static reorderItems = handle("Items reordered", (req) => svc().reorderItems(actorOf(req), input(req, reorderSchema).body.ids));

  // Option groups & options
  static listGroups = handle("Option groups fetched", (req) => svc().listGroups(actorOf(req)));
  static createGroup = handle("Option group created", (req) => svc().createGroup(actorOf(req), input(req, createGroupSchema).body), 201);
  static updateGroup = handle("Option group updated", (req) => {
    const { params, body } = input(req, updateGroupSchema);
    return svc().updateGroup(actorOf(req), params.id, body);
  });
  static deleteGroup = handle("Option group deleted", (req) => svc().deleteGroup(actorOf(req), id(req)));
  static createOption = handle("Option added", (req) => {
    const { params, body } = input(req, createOptionSchema);
    return svc().createOption(actorOf(req), params.id, body);
  }, 201);
  static updateOption = handle("Option updated", (req) => {
    const { params, body } = input(req, updateOptionSchema);
    return svc().updateOption(actorOf(req), params.id, params.optionId, body);
  });
  static deleteOption = handle("Option deleted", (req) => {
    const { params } = input(req, optionIdSchema);
    return svc().deleteOption(actorOf(req), params.id, params.optionId);
  });

  // Storefront
  static storeMenus = handle("Menus fetched", async (req) => {
    const { params } = input(req, storeMenusSchema);
    return StorefrontMenuService.Instance.menusForBranch((await store(params.slug)).id, params.branchId);
  });
  static storeMenu = handle("Menu fetched", async (req) => {
    const { params, query } = input(req, storeMenuSchema);
    return StorefrontMenuService.Instance.menuTree((await store(params.slug)).id, params.id, query.branchId);
  });
  static storeMenuVersion = handle("Menu version", async (req) => {
    const { params } = input(req, storeMenuSchema);
    return StorefrontMenuService.Instance.version((await store(params.slug)).id, params.id);
  });
  static storeItem = handle("Item fetched", async (req) => {
    const { params, query } = input(req, storeItemSchema);
    return StorefrontMenuService.Instance.item((await store(params.slug)).id, params.id, query.branchId);
  });
  static storeSearch = handle("Search results", async (req) => {
    const { params, query } = input(req, storeSearchSchema);
    return StorefrontMenuService.Instance.search((await store(params.slug)).id, query.branchId, query.q, query.menuId);
  });
  static storeFeatured = handle("Featured items", async (req) => {
    const { params, query } = input(req, storeFeaturedSchema);
    return StorefrontMenuService.Instance.featured((await store(params.slug)).id, query.branchId);
  });
}
