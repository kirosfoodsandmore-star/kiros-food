// Socket.io: live order board, availability pushes, menu version pushes, chat nudges, presence.
//
// Staff connect with `auth: { token }` (staff access token) and join `org:<id>` plus, per branch, one room for each kind of
// event their role may read: orders (orders.view), payments (payments.view), chat (chat.view), availability (availability.view).
// A kitchen screen or a rider's phone therefore never receives chat messages or payment claims it couldn't open.
// Customers connect with `auth: { customerToken }` and join `customer:<id>`; they may `order:watch`
// an order they own to receive its status changes.
//
// Server → staff rooms:      order:new · order:updated · availability:changed · menu:version · chat:message · payment:claimed
// Server → one staff member:  delivery:assigned / delivery:ready / delivery:updated (to the rider, in their own `user:<id>` room); delivery:declined (to each manager who can reassign)
// Server → customer rooms:   order:updated · chat:message
// Server → platform admins:  presence:online · presence:offline · platform:signup
import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { BOARD_STATUSES } from "../../config/constants";
import { resolveActor } from "../../modules/auth/services/actorResolver";
import { resolveCustomer } from "../../modules/customer/services/customerResolver";
import { OrderRepository } from "../../modules/order/repositories/order.repository";
import { PlatformRepository } from "../../modules/platform/repositories/platform.repository";
import { markSeen } from "../../modules/platform/services/lastSeen";
import { can, isPlatformAdmin } from "../../shared/access/can";
import { domainEvents } from "../../shared/events/domainEvents";
import { isAllowedOrigin } from "../../shared/http/cors";
import type { Actor, CustomerActor } from "../../shared/types/actor";
import { verifyAccessToken, verifyCustomerToken } from "../../shared/utils/jwt";
import { maskPhone } from "../../shared/utils/mask";
import { describeDevice, presence } from "./presence";

export const PLATFORM_ROOM = "platform-admins";

interface SocketData {
  kind: "staff" | "customer";
  actor?: Actor;
  customer?: CustomerActor;
  isPlatformAdmin: boolean;
}

type AppServer = Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;
type AppSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

let io: AppServer | null = null;
let registered = false;

export const realtimeEnabled = (): boolean => io !== null;

export function emitToOrg(organizationId: string, event: string, payload: unknown): void {
  io?.to(`org:${organizationId}`).emit(event as never, payload as never);
}

/** The kinds of branch event a staff member can be allowed to receive (see onStaffConnection). */
type RoomTopic = "orders" | "payments" | "chat" | "availability";

export function emitToBranch(organizationId: string, branchId: string, event: string, payload: unknown, topic: RoomTopic = "orders"): void {
  io?.to(`branch:${branchId}:${topic}`).emit(event as never, payload as never);
  io?.to(`org-all:${organizationId}:${topic}`).emit(event as never, payload as never);
}

/** Live events go to a whole room of people with different rights, so a phone number is never sent in full (screens refetch the real thing). */
const withoutPhone = <T extends { customerPhone: string }>(s: T): T => ({ ...s, customerPhone: maskPhone(s.customerPhone) ?? "" });

export function emitToCustomer(customerId: string, event: string, payload: unknown): void {
  io?.to(`customer:${customerId}`).emit(event as never, payload as never);
}

/** To one staff member, on every device they're signed in on. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event as never, payload as never);
}

function registerForwarding(): void {
  if (registered) return;
  registered = true;
  const orders = OrderRepository.Instance;

  domainEvents.on("order.paid", async ({ organizationId, orderId }) => {
    const summary = await orders.summary(organizationId, orderId);
    if (summary) emitToBranch(organizationId, summary.branchId, "order:new", withoutPhone(summary));
  });
  domainEvents.on("order.statusChanged", async ({ organizationId, orderId, from, to, note }) => {
    const summary = await orders.summary(organizationId, orderId);
    if (!summary) return;
    emitToBranch(organizationId, summary.branchId, "order:updated", { ...withoutPhone(summary), from, to, note });
    // A rider has no right to the order feed, so their own delivery gets a quiet nudge to refresh instead.
    if (summary.riderId) emitToUser(summary.riderId, "delivery:updated", { id: summary.id, status: summary.status });
    emitToCustomer(summary.customerId, "order:updated", { id: summary.id, number: summary.number, status: summary.status, from, to, note, updatedAt: summary.updatedAt });
  });
  domainEvents.on("order.riderAssigned", async ({ organizationId, orderId, riderId }) => {
    const [delivery] = await orders.riderDeliveries(organizationId, { orderId, branchIds: null, statuses: [...BOARD_STATUSES] });
    if (!delivery) return;
    emitToUser(riderId, "delivery:assigned", { id: delivery.id, number: delivery.number, status: delivery.status, riderResponse: delivery.riderResponse, branchName: delivery.branchName, address: delivery.deliveryAddress?.line ?? null });
  });
  // The food a rider is carrying is ready to collect.
  domainEvents.on("order.statusChanged", async ({ organizationId, orderId, to, from }) => {
    if (to !== "ready" || from === "ready") return;
    const [delivery] = await orders.riderDeliveries(organizationId, { orderId, branchIds: null, statuses: [...BOARD_STATUSES] });
    if (!delivery?.riderId) return;
    emitToUser(delivery.riderId, "delivery:ready", { id: delivery.id, number: delivery.number, branchName: delivery.branchName, address: delivery.deliveryAddress?.line ?? null, riderResponse: delivery.riderResponse });
  });
  // Nobody answered in time: managers see where it went, and the rider who missed it sees it leave their list.
  domainEvents.on("order.riderTimedOut", (e) => {
    for (const managerId of e.managerIds) emitToUser(managerId, "delivery:passed", { id: e.orderId, number: e.number, branchName: e.branchName, riderName: e.riderName, nextRiderName: e.nextRiderName });
    emitToUser(e.riderId, "delivery:expired", { id: e.orderId, number: e.number });
  });
  // A rider gave a delivery back: tell the managers who can hand it to someone else.
  domainEvents.on("order.riderDeclined", (e) => {
    for (const managerId of e.managerIds) emitToUser(managerId, "delivery:declined", { id: e.orderId, number: e.number, branchName: e.branchName, riderName: e.riderName, reason: e.reason });
  });
  domainEvents.on("payment.claimed", async ({ organizationId, orderId, paymentId }) => {
    const summary = await orders.summary(organizationId, orderId);
    if (summary) emitToBranch(organizationId, summary.branchId, "payment:claimed", { ...withoutPhone(summary), paymentId }, "payments");
  });
  domainEvents.on("availability.changed", (e) => emitToBranch(e.organizationId, e.branchId, "availability:changed", e, "availability"));
  domainEvents.on("menu.versionBumped", (e) => emitToOrg(e.organizationId, "menu:version", e));
  domainEvents.on("chat.message", (e) => {
    emitToBranch(e.organizationId, e.branchId, "chat:message", e, "chat");
    emitToCustomer(e.customerId, "chat:message", e);
  });
  domainEvents.on("restaurant.registered", async ({ organizationId, method }) => {
    io?.to(PLATFORM_ROOM).emit("platform:signup" as never, { organizationId, method, at: new Date().toISOString() } as never);
  });
}

async function onStaffConnection(socket: AppSocket, actor: Actor): Promise<void> {
  const profile = await PlatformRepository.Instance.presenceProfile(actor.id).catch(() => null);
  if (!profile) {
    socket.disconnect(true);
    return;
  }
  const rooms = [`user:${actor.id}`, `org:${actor.organizationId}`];
  const topics: RoomTopic[] = [];
  if (can(actor, "orders.view")) topics.push("orders");
  if (can(actor, "payments.view")) topics.push("payments");
  if (can(actor, "chat.view")) topics.push("chat");
  if (can(actor, "availability.view")) topics.push("availability");
  const everywhere = actor.allBranches || actor.permissions.includes("*");
  for (const topic of topics) {
    if (everywhere) rooms.push(`org-all:${actor.organizationId}:${topic}`);
    else rooms.push(...actor.branchIds.map((b) => `branch:${b}:${topic}`));
  }
  if (socket.data.isPlatformAdmin) rooms.push(PLATFORM_ROOM);
  void socket.join(rooms);
  const cameOnline = presence.connect(socket.id, profile, describeDevice(socket.handshake.headers["user-agent"]));
  markSeen(actor.id, { force: cameOnline });
  if (cameOnline) io?.to(PLATFORM_ROOM).emit("presence:online" as never, presence.get(actor.id) as never);

  socket.on("presence:activity" as never, () => {
    presence.activity(actor.id, socket.id);
    markSeen(actor.id);
  });
  socket.on("disconnect", () => {
    const wentOffline = presence.disconnect(actor.id, socket.id);
    markSeen(actor.id, { force: wentOffline });
    if (wentOffline) io?.to(PLATFORM_ROOM).emit("presence:offline" as never, { userId: actor.id, name: profile.name, restaurantName: profile.restaurantName, at: new Date().toISOString() } as never);
  });
}

function onCustomerConnection(socket: AppSocket, customer: CustomerActor): void {
  void socket.join([`customer:${customer.id}`]);
  // Customers may also watch a specific order they own (same room semantics as customer:<id>).
  socket.on("order:watch" as never, (async (orderId: unknown) => {
    if (typeof orderId !== "string") return;
    const order = await OrderRepository.Instance.findById(customer.organizationId, orderId).catch(() => null);
    if (order && order.customerId === customer.id) void socket.join(`order:${orderId}`);
  }) as never);
}

export function attachSocketServer(httpServer: HttpServer): AppServer {
  io = new Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket: AppSocket, next) => {
    try {
      const auth = socket.handshake.auth ?? {};
      if (typeof auth.token === "string" && auth.token) {
        const payload = verifyAccessToken(auth.token);
        const actor = await resolveActor(payload.sub, payload.org);
        if (!actor) throw new Error("inactive");
        socket.data = { kind: "staff", actor, isPlatformAdmin: isPlatformAdmin(actor) };
        return next();
      }
      if (typeof auth.customerToken === "string" && auth.customerToken) {
        const payload = verifyCustomerToken(auth.customerToken);
        const customer = await resolveCustomer(payload.sub, payload.org);
        if (!customer) throw new Error("blocked");
        socket.data = { kind: "customer", customer, isPlatformAdmin: false };
        return next();
      }
      throw new Error("missing token");
    } catch {
      next(new Error("unauthorised"));
    }
  });

  io.on("connection", (socket: AppSocket) => {
    const run = socket.data.kind === "staff" && socket.data.actor ? onStaffConnection(socket, socket.data.actor) : Promise.resolve(onCustomerConnection(socket, socket.data.customer!));
    run.catch((err) => {
      console.error("[socket] connection setup failed", err);
      socket.disconnect(true);
    });
  });

  registerForwarding();
  return io;
}

export function closeSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
    io = null;
  });
}
