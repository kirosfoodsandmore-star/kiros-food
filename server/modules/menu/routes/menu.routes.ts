import { Router } from "express";
import { publicRoute, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { MAX_ITEM_PHOTOS } from "../../../config/constants";
import { uploadImage, uploadImages } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { MenuController as C } from "../controllers/menu.controller";
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

const view = [authMiddleware, requirePermission("menu.view")] as const;
const edit = [authMiddleware, requirePermission("menu.edit")] as const;

/** /api/v1/admin/menus */
export const adminMenuRouter = Router();
adminMenuRouter.get("/", ...view, C.listMenus);
adminMenuRouter.post("/", ...edit, validate(createMenuSchema), C.createMenu);
adminMenuRouter.post("/reorder", ...edit, validate(reorderSchema), C.reorderMenus);
adminMenuRouter.put("/:id", ...edit, validate(updateMenuSchema), C.updateMenu);
adminMenuRouter.delete("/:id", ...edit, validate(menuIdSchema), C.deleteMenu);
adminMenuRouter.post("/:id/image", ...edit, uploadImage("image"), validate(menuIdSchema), C.uploadMenuImage);

/** /api/v1/admin/categories */
export const adminCategoryRouter = Router();
adminCategoryRouter.get("/", ...view, validate(listCategoriesSchema), C.listCategories);
adminCategoryRouter.post("/", ...edit, validate(createCategorySchema), C.createCategory);
adminCategoryRouter.post("/reorder", ...edit, validate(reorderSchema), C.reorderCategories);
adminCategoryRouter.put("/:id", ...edit, validate(updateCategorySchema), C.updateCategory);
adminCategoryRouter.delete("/:id", ...edit, validate(menuIdSchema), C.deleteCategory);
adminCategoryRouter.post("/:id/image", ...edit, uploadImage("image"), validate(menuIdSchema), C.uploadCategoryImage);

/** /api/v1/admin/items */
export const adminItemRouter = Router();
adminItemRouter.get("/", ...view, validate(listItemsSchema), C.listItems);
adminItemRouter.post("/", ...edit, validate(createItemSchema), C.createItem);
adminItemRouter.post("/reorder", ...edit, validate(reorderSchema), C.reorderItems);
adminItemRouter.get("/:id", ...view, validate(menuIdSchema), C.getItem);
adminItemRouter.put("/:id", ...edit, validate(updateItemSchema), C.updateItem);
adminItemRouter.delete("/:id", ...edit, validate(menuIdSchema), C.deleteItem);
adminItemRouter.post("/:id/photos", ...edit, uploadImages("photos", MAX_ITEM_PHOTOS), validate(menuIdSchema), C.addItemPhotos);
adminItemRouter.put("/:id/photos/order", ...edit, validate(reorderPhotosSchema), C.reorderItemPhotos);
adminItemRouter.delete("/:id/photos/:photoId", ...edit, validate(itemPhotoSchema), C.removeItemPhoto);

/** /api/v1/admin/option-groups */
export const adminOptionGroupRouter = Router();
adminOptionGroupRouter.get("/", ...view, C.listGroups);
adminOptionGroupRouter.post("/", ...edit, validate(createGroupSchema), C.createGroup);
adminOptionGroupRouter.put("/:id", ...edit, validate(updateGroupSchema), C.updateGroup);
adminOptionGroupRouter.delete("/:id", ...edit, validate(menuIdSchema), C.deleteGroup);
adminOptionGroupRouter.post("/:id/options", ...edit, validate(createOptionSchema), C.createOption);
adminOptionGroupRouter.put("/:id/options/:optionId", ...edit, validate(updateOptionSchema), C.updateOption);
adminOptionGroupRouter.delete("/:id/options/:optionId", ...edit, validate(optionIdSchema), C.deleteOption);

/** /api/v1/store/:slug (menus, items, search, featured) — mounted with mergeParams */
export const storeMenuRouter = Router({ mergeParams: true });
storeMenuRouter.get("/branches/:branchId/menus", publicRoute("storefront menus for a branch"), validate(storeMenusSchema), C.storeMenus);
storeMenuRouter.get("/menus/:id", publicRoute("storefront menu tree"), validate(storeMenuSchema), C.storeMenu);
storeMenuRouter.get("/menus/:id/version", publicRoute("storefront menu version poll"), validate(storeMenuSchema), C.storeMenuVersion);
storeMenuRouter.get("/items/:id", publicRoute("storefront item detail"), validate(storeItemSchema), C.storeItem);
storeMenuRouter.get("/search", publicRoute("storefront item search"), validate(storeSearchSchema), C.storeSearch);
storeMenuRouter.get("/featured", publicRoute("storefront featured items"), validate(storeFeaturedSchema), C.storeFeatured);
