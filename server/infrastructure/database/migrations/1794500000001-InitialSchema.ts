import type { MigrationInterface, QueryRunner } from "typeorm";

/** Tenant, access, staff, branches, menu tree, customers, carts, promos, orders, payments, chat. */
export class InitialSchema1794500000001 implements MigrationInterface {
  name = "InitialSchema1794500000001";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── Tenant ───────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "organizations" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(160) NOT NULL,
      "slug" varchar(60) NOT NULL,
      "legal_name" varchar(200),
      "phone" varchar(30),
      "email" varchar(160),
      "address" text,
      "logo_url" varchar(500),
      "logo_public_id" varchar(255),
      "currency_code" varchar(3) NOT NULL DEFAULT 'NGN',
      "currency_symbol" varchar(8) NOT NULL DEFAULT '₦',
      "currency_decimals" int NOT NULL DEFAULT 0,
      "timezone" varchar(60) NOT NULL DEFAULT 'Africa/Lagos',
      "tagline" varchar(200),
      "social_links" jsonb,
      "order_prefix" varchar(6) NOT NULL DEFAULT 'ORD',
      "notify_staff_new_orders" boolean NOT NULL DEFAULT true,
      "notify_customers_by_email" boolean NOT NULL DEFAULT true,
      "is_suspended" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_organizations" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_organizations_slug" ON "organizations" ("slug")`);

    await q.query(`CREATE TABLE "counters" (
      "organization_id" uuid NOT NULL,
      "key" varchar(40) NOT NULL,
      "value" bigint NOT NULL DEFAULT 0,
      CONSTRAINT "PK_counters" PRIMARY KEY ("organization_id", "key"))`);

    // ── Access & staff ───────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "roles" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "key" varchar(40) NOT NULL,
      "name" varchar(80) NOT NULL,
      "description" text,
      "permissions" text[] NOT NULL DEFAULT '{}',
      "is_preset" boolean NOT NULL DEFAULT false,
      "is_locked" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_roles" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_roles_org_key" ON "roles" ("organization_id", "key") WHERE deleted_at IS NULL`);

    await q.query(`CREATE TABLE "users" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
      "name" varchar(120) NOT NULL,
      "email" varchar(160) NOT NULL,
      "password_hash" varchar(100) NOT NULL,
      "firebase_uid" varchar(128),
      "phone" varchar(30),
      "branch_ids" uuid[] NOT NULL DEFAULT '{}',
      "all_branches" boolean NOT NULL DEFAULT false,
      "is_active" boolean NOT NULL DEFAULT true,
      "last_login_at" timestamptz,
      "last_seen_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_users" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_users_org" ON "users" ("organization_id")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") WHERE deleted_at IS NULL`);

    await q.query(`CREATE TABLE "staff_invites" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "email" varchar(160) NOT NULL,
      "name" varchar(120) NOT NULL,
      "role_id" uuid NOT NULL,
      "branch_ids" uuid[] NOT NULL DEFAULT '{}',
      "all_branches" boolean NOT NULL DEFAULT false,
      "token_hash" varchar(64) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "accepted_at" timestamptz,
      "revoked_at" timestamptz,
      "invited_by_id" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_staff_invites" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_staff_invites_token" ON "staff_invites" ("token_hash")`);
    await q.query(`CREATE INDEX "IDX_staff_invites_org_email" ON "staff_invites" ("organization_id", "email")`);

    await q.query(`CREATE TABLE "refresh_tokens" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "subject_type" varchar(10) NOT NULL,
      "subject_id" uuid NOT NULL,
      "token_hash" varchar(64) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "revoked_at" timestamptz,
      "user_agent" varchar(255),
      "ip" varchar(64),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`);
    await q.query(`CREATE INDEX "IDX_refresh_tokens_subject" ON "refresh_tokens" ("subject_type", "subject_id")`);

    await q.query(`CREATE TABLE "password_resets" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "code_hash" varchar(64) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "attempts" int NOT NULL DEFAULT 0,
      "used_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_password_resets" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_password_resets_user" ON "password_resets" ("user_id", "created_at")`);

    await q.query(`CREATE TABLE "audit_logs" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "branch_id" uuid,
      "user_id" uuid,
      "user_name" varchar(120),
      "action" varchar(40) NOT NULL,
      "entity_type" varchar(60) NOT NULL,
      "entity_id" uuid,
      "summary" varchar(255) NOT NULL,
      "before" jsonb,
      "after" jsonb,
      "ip" varchar(64),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_audit_logs_org_created" ON "audit_logs" ("organization_id", "created_at")`);
    await q.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("organization_id", "entity_type", "entity_id")`);
    await q.query(`CREATE INDEX "IDX_audit_logs_user" ON "audit_logs" ("organization_id", "user_id")`);

    // ── Branches ─────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "branches" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "city" varchar(80) NOT NULL,
      "address" text NOT NULL,
      "lat" double precision,
      "lng" double precision,
      "phone" varchar(30),
      "timezone" varchar(60) NOT NULL DEFAULT 'Africa/Lagos',
      "is_paused" boolean NOT NULL DEFAULT false,
      "pause_reason" varchar(200),
      "delivery_enabled" boolean NOT NULL DEFAULT true,
      "pickup_enabled" boolean NOT NULL DEFAULT true,
      "prep_time_minutes" int NOT NULL DEFAULT 20,
      "slot_interval_minutes" int NOT NULL DEFAULT 15,
      "payment_method_override" varchar(10),
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "CHK_branches_payment_override" CHECK ("payment_method_override" IS NULL OR "payment_method_override" IN ('paystack','transfer')),
      CONSTRAINT "PK_branches" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_branches_org" ON "branches" ("organization_id", "sort_order")`);

    await q.query(`CREATE TABLE "opening_hours" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "weekday" int NOT NULL,
      "opens_at" varchar(5) NOT NULL,
      "closes_at" varchar(5) NOT NULL,
      CONSTRAINT "CHK_opening_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6),
      CONSTRAINT "PK_opening_hours" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_opening_hours_branch" ON "opening_hours" ("branch_id", "weekday")`);

    await q.query(`CREATE TABLE "holiday_closures" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "date" date NOT NULL,
      "reason" varchar(160),
      CONSTRAINT "PK_holiday_closures" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_holiday_closures_branch_date" ON "holiday_closures" ("branch_id", "date")`);

    await q.query(`CREATE TABLE "delivery_zones" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "organization_id" uuid NOT NULL,
      "name" varchar(80) NOT NULL,
      "max_distance_km" double precision NOT NULL,
      "fee" bigint NOT NULL DEFAULT 0,
      "min_order" bigint NOT NULL DEFAULT 0,
      "free_above_amount" bigint,
      "extra_minutes" int NOT NULL DEFAULT 0,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_delivery_zones" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_delivery_zones_branch" ON "delivery_zones" ("branch_id")`);

    // ── Menu tree ────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "menus" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "description" text,
      "image_url" varchar(500),
      "image_public_id" varchar(255),
      "sort_order" int NOT NULL DEFAULT 0,
      "version" int NOT NULL DEFAULT 1,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_menus" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_menus_org" ON "menus" ("organization_id", "sort_order")`);

    await q.query(`CREATE TABLE "branch_menus" (
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "menu_id" uuid NOT NULL REFERENCES "menus"("id") ON DELETE CASCADE,
      "sort_order" int NOT NULL DEFAULT 0,
      CONSTRAINT "PK_branch_menus" PRIMARY KEY ("branch_id", "menu_id"))`);
    await q.query(`CREATE INDEX "IDX_branch_menus_menu" ON "branch_menus" ("menu_id")`);

    await q.query(`CREATE TABLE "categories" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "menu_id" uuid NOT NULL REFERENCES "menus"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "description" text,
      "image_url" varchar(500),
      "image_public_id" varchar(255),
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_categories" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_categories_menu" ON "categories" ("menu_id", "sort_order")`);

    await q.query(`CREATE TABLE "items" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
      "name" varchar(160) NOT NULL,
      "description" text,
      "base_price" bigint NOT NULL DEFAULT 0,
      "image_url" varchar(500),
      "image_public_id" varchar(255),
      "is_featured" boolean NOT NULL DEFAULT false,
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "CHK_items_price" CHECK ("base_price" >= 0),
      CONSTRAINT "PK_items" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_items_category" ON "items" ("category_id", "sort_order")`);
    await q.query(`CREATE INDEX "IDX_items_org_featured" ON "items" ("organization_id", "is_featured")`);

    await q.query(`CREATE TABLE "option_groups" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "help_text" text,
      "min_select" int NOT NULL DEFAULT 0,
      "max_select" int NOT NULL DEFAULT 1,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "CHK_option_groups_minmax" CHECK ("min_select" >= 0 AND "max_select" >= 1 AND "min_select" <= "max_select"),
      CONSTRAINT "PK_option_groups" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_option_groups_org" ON "option_groups" ("organization_id")`);

    await q.query(`CREATE TABLE "options" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "group_id" uuid NOT NULL REFERENCES "option_groups"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "price_delta" bigint NOT NULL DEFAULT 0,
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_options" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_options_group" ON "options" ("group_id", "sort_order")`);

    await q.query(`CREATE TABLE "item_option_groups" (
      "item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
      "group_id" uuid NOT NULL REFERENCES "option_groups"("id") ON DELETE CASCADE,
      "sort_order" int NOT NULL DEFAULT 0,
      CONSTRAINT "PK_item_option_groups" PRIMARY KEY ("item_id", "group_id"))`);
    await q.query(`CREATE INDEX "IDX_item_option_groups_group" ON "item_option_groups" ("group_id")`);

    await q.query(`CREATE TABLE "availability" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "item_id" uuid REFERENCES "items"("id") ON DELETE CASCADE,
      "option_id" uuid REFERENCES "options"("id") ON DELETE CASCADE,
      "restore_at" timestamptz,
      "updated_by_id" uuid,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_availability_target" CHECK (("item_id" IS NULL) <> ("option_id" IS NULL)),
      CONSTRAINT "PK_availability" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_availability_branch_item" ON "availability" ("branch_id", "item_id") WHERE item_id IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX "UQ_availability_branch_option" ON "availability" ("branch_id", "option_id") WHERE option_id IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_availability_restore" ON "availability" ("restore_at")`);

    // ── Customers, carts, promos ─────────────────────────────────────────────
    await q.query(`CREATE TABLE "customers" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "firebase_uid" varchar(128),
      "phone" varchar(20),
      "name" varchar(120),
      "email" varchar(160),
      "is_blocked" boolean NOT NULL DEFAULT false,
      "block_reason" varchar(200),
      "order_count" int NOT NULL DEFAULT 0,
      "total_spend" bigint NOT NULL DEFAULT 0,
      "last_order_at" timestamptz,
      "last_seen_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_customers" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_customers_org_phone" ON "customers" ("organization_id", "phone") WHERE phone IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX "UQ_customers_org_uid" ON "customers" ("organization_id", "firebase_uid") WHERE firebase_uid IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_customers_org_email" ON "customers" ("organization_id", "email")`);

    await q.query(`CREATE TABLE "addresses" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
      "label" varchar(40),
      "line" text NOT NULL,
      "lat" double precision,
      "lng" double precision,
      "instructions" varchar(255),
      "is_default" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_addresses" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_addresses_customer" ON "addresses" ("customer_id")`);

    await q.query(`CREATE TABLE "carts" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
      "menu_id" uuid,
      "token_hash" varchar(64) NOT NULL,
      "customer_id" uuid,
      "fulfilment" varchar(10) NOT NULL DEFAULT 'delivery',
      "scheduled_for" timestamptz,
      "promo_code" varchar(40),
      "delivery_address" jsonb,
      "phone" varchar(20),
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_carts" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_carts_token" ON "carts" ("token_hash")`);
    await q.query(`CREATE INDEX "IDX_carts_expires" ON "carts" ("expires_at")`);

    await q.query(`CREATE TABLE "cart_lines" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "cart_id" uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
      "item_id" uuid NOT NULL,
      "quantity" int NOT NULL DEFAULT 1,
      "note" varchar(255),
      "selected_option_ids" uuid[] NOT NULL DEFAULT '{}',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_cart_lines_qty" CHECK ("quantity" > 0),
      CONSTRAINT "PK_cart_lines" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_cart_lines_cart" ON "cart_lines" ("cart_id")`);

    await q.query(`CREATE TABLE "promo_codes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "code" varchar(40) NOT NULL,
      "type" varchar(10) NOT NULL,
      "value" bigint NOT NULL DEFAULT 0,
      "starts_at" timestamptz,
      "ends_at" timestamptz,
      "max_uses" int,
      "used_count" int NOT NULL DEFAULT 0,
      "max_uses_per_customer" int,
      "min_spend" bigint NOT NULL DEFAULT 0,
      "branch_id" uuid,
      "menu_id" uuid,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "CHK_promo_codes_type" CHECK ("type" IN ('percent','fixed')),
      CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_promo_codes_org_code" ON "promo_codes" ("organization_id", "code") WHERE deleted_at IS NULL`);

    // ── Orders ───────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "orders" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
      "menu_id" uuid,
      "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
      "number" varchar(24) NOT NULL,
      "fulfilment" varchar(10) NOT NULL,
      "scheduled_for" timestamptz,
      "delivery_address" jsonb,
      "customer_phone" varchar(20) NOT NULL,
      "customer_name" varchar(120),
      "customer_email" varchar(160),
      "subtotal" bigint NOT NULL DEFAULT 0,
      "delivery_fee" bigint NOT NULL DEFAULT 0,
      "discount" bigint NOT NULL DEFAULT 0,
      "promo_code" varchar(40),
      "total" bigint NOT NULL DEFAULT 0,
      "status" varchar(24) NOT NULL DEFAULT 'pending_payment',
      "payment_method" varchar(10) NOT NULL,
      "paid_at" timestamptz,
      "accepted_at" timestamptz,
      "ready_at" timestamptz,
      "completed_at" timestamptz,
      "cancelled_at" timestamptz,
      "cancel_reason" varchar(255),
      "refunded_at" timestamptz,
      "refund_note" text,
      "rider_id" uuid,
      "note" varchar(500),
      "expires_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_orders_status" CHECK ("status" IN ('pending_payment','awaiting_confirmation','paid','accepted','preparing','ready','out_for_delivery','completed','cancelled','refunded')),
      CONSTRAINT "PK_orders" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_orders_org_number" ON "orders" ("organization_id", "number")`);
    await q.query(`CREATE INDEX "IDX_orders_branch_status_created" ON "orders" ("organization_id", "branch_id", "status", "created_at")`);
    await q.query(`CREATE INDEX "IDX_orders_customer_created" ON "orders" ("customer_id", "created_at")`);
    await q.query(`CREATE INDEX "IDX_orders_org_created" ON "orders" ("organization_id", "created_at")`);
    await q.query(`CREATE INDEX "IDX_orders_expires" ON "orders" ("expires_at")`);

    await q.query(`CREATE TABLE "order_lines" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "item_id" uuid,
      "item_name" varchar(160) NOT NULL,
      "category_name" varchar(120),
      "image_url" varchar(500),
      "quantity" int NOT NULL DEFAULT 1,
      "unit_price" bigint NOT NULL DEFAULT 0,
      "line_total" bigint NOT NULL DEFAULT 0,
      "note" varchar(255),
      "options" jsonb NOT NULL DEFAULT '[]',
      CONSTRAINT "PK_order_lines" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_order_lines_order" ON "order_lines" ("order_id")`);
    await q.query(`CREATE INDEX "IDX_order_lines_item" ON "order_lines" ("item_id")`);

    await q.query(`CREATE TABLE "order_status_events" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "organization_id" uuid NOT NULL,
      "from_status" varchar(24),
      "to_status" varchar(24) NOT NULL,
      "actor_type" varchar(10) NOT NULL,
      "actor_id" uuid,
      "actor_name" varchar(120),
      "note" varchar(500),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_order_status_events" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_order_status_events_order" ON "order_status_events" ("order_id", "created_at")`);

    // ── Payments ─────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "payment_settings" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "paystack_enabled" boolean NOT NULL DEFAULT false,
      "transfer_enabled" boolean NOT NULL DEFAULT true,
      "paystack_public_key" varchar(120),
      "paystack_secret_key_sealed" text,
      "paystack_mode" varchar(5) NOT NULL DEFAULT 'test',
      "transfer_window_minutes" int NOT NULL DEFAULT 30,
      "transfer_instructions" text,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_payment_settings" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_payment_settings_org" ON "payment_settings" ("organization_id")`);

    await q.query(`CREATE TABLE "bank_accounts" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "branch_id" uuid,
      "bank_name" varchar(120) NOT NULL,
      "account_name" varchar(160) NOT NULL,
      "account_number" varchar(34) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_bank_accounts" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_bank_accounts_org" ON "bank_accounts" ("organization_id")`);

    await q.query(`CREATE TABLE "payments" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "method" varchar(10) NOT NULL,
      "amount" bigint NOT NULL DEFAULT 0,
      "currency" varchar(3) NOT NULL DEFAULT 'NGN',
      "reference" varchar(80) NOT NULL,
      "status" varchar(12) NOT NULL DEFAULT 'pending',
      "authorization_url" varchar(500),
      "channel" varchar(40),
      "proof_url" varchar(500),
      "proof_public_id" varchar(255),
      "claim_note" varchar(255),
      "claimed_at" timestamptz,
      "expires_at" timestamptz,
      "paid_at" timestamptz,
      "confirmed_by_id" uuid,
      "confirmed_at" timestamptz,
      "rejected_by_id" uuid,
      "rejected_at" timestamptz,
      "reject_reason" text,
      "refunded_at" timestamptz,
      "refund_amount" bigint,
      "refund_reference" varchar(80),
      "provider_payload" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_payments" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_payments_reference" ON "payments" ("reference")`);
    await q.query(`CREATE INDEX "IDX_payments_order" ON "payments" ("order_id", "created_at")`);
    await q.query(`CREATE INDEX "IDX_payments_org_status" ON "payments" ("organization_id", "status", "created_at")`);

    // ── Chat ─────────────────────────────────────────────────────────────────
    await q.query(`CREATE TABLE "chat_conversations" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL,
      "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "customer_id" uuid NOT NULL,
      "last_message_at" timestamptz,
      "last_message_preview" varchar(160),
      "last_sender_type" varchar(10),
      "staff_unread" int NOT NULL DEFAULT 0,
      "customer_unread" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_conversations" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_chat_conversations_order" ON "chat_conversations" ("order_id")`);
    await q.query(`CREATE INDEX "IDX_chat_conversations_branch_last" ON "chat_conversations" ("organization_id", "branch_id", "last_message_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      "chat_conversations",
      "payments",
      "bank_accounts",
      "payment_settings",
      "order_status_events",
      "order_lines",
      "orders",
      "promo_codes",
      "cart_lines",
      "carts",
      "addresses",
      "customers",
      "availability",
      "item_option_groups",
      "options",
      "option_groups",
      "items",
      "categories",
      "branch_menus",
      "menus",
      "delivery_zones",
      "holiday_closures",
      "opening_hours",
      "branches",
      "audit_logs",
      "password_resets",
      "refresh_tokens",
      "staff_invites",
      "users",
      "roles",
      "counters",
      "organizations",
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
