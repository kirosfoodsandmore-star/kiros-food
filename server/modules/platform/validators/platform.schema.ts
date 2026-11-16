import { z } from "zod";
import { idParams, pageQuery, queryBool } from "../../../shared/validation/common";

export const listRestaurantsSchema = z.object({ query: z.object({ ...pageQuery, suspended: queryBool.optional() }) });
export const restaurantIdSchema = z.object({ params: idParams });
