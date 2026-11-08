import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { Property, Listing } from "@petra/domain";
import { z } from "zod";
import { db } from "../../db.js";
import { tid, tx } from "../../store.js";

const CreateProperty = Property.omit({ id: true, tenantId: true });
const CreateListing = Listing.omit({ id: true, tenantId: true });

export const propertiesModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const p: Property = { ...CreateProperty.parse(req.body), id: randomUUID(), tenantId: tid(req) };
    return reply.code(201).send(db.properties.add(p));
  });
  app.get("/", async (req) => db.properties.list(tid(req)));
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const cur = db.properties.get(tid(req), req.params.id);
    if (!cur) return reply.code(404).send({ error: "not found" });
    const patch = CreateProperty.partial().parse(req.body);
    return db.properties.save(Property.parse({ ...cur, ...patch, id: cur.id, tenantId: cur.tenantId }));
  });
  // Blocked while money depends on it (deal on one of its listings, or a lease). Its listings go with it.
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const t = tid(req);
    if (!db.properties.get(t, req.params.id)) return reply.code(404).send({ error: "not found" });
    const listings = db.listings.list(t).filter((l) => l.propertyId === req.params.id);
    if (db.leases.list(t).some((x) => x.propertyId === req.params.id)) return reply.code(409).send({ error: "Property has a lease. Remove the lease first." });
    if (db.deals.list(t).some((d) => listings.some((l) => l.id === d.listingId))) return reply.code(409).send({ error: "Property has a deal. It cannot be deleted." });
    tx(() => { listings.forEach((l) => db.listings.remove(t, l.id)); db.properties.remove(t, req.params.id); });
    return reply.code(204).send();
  });
};

export const listingsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const body = CreateListing.parse(req.body);
    if (!db.properties.get(t, body.propertyId)) return reply.code(404).send({ error: "property not found" });
    return reply.code(201).send(db.listings.add({ ...body, id: randomUUID(), tenantId: t }));
  });
  app.get("/", async (req) => db.listings.list(tid(req)));
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const cur = db.listings.get(tid(req), req.params.id);
    if (!cur) return reply.code(404).send({ error: "not found" });
    const patch = CreateListing.omit({ propertyId: true }).partial().parse(req.body);
    return db.listings.save(Listing.parse({ ...cur, ...patch, id: cur.id, tenantId: cur.tenantId, propertyId: cur.propertyId }));
  });
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const t = tid(req);
    if (!db.listings.get(t, req.params.id)) return reply.code(404).send({ error: "not found" });
    if (db.deals.list(t).some((d) => d.listingId === req.params.id)) return reply.code(409).send({ error: "Listing has a deal. It cannot be deleted." });
    db.listings.remove(t, req.params.id);
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/:id/status", async (req, reply) => {
    const l = db.listings.get(tid(req), req.params.id);
    if (!l) return reply.code(404).send({ error: "not found" });
    l.status = z.object({ status: Listing.shape.status }).parse(req.body).status;
    return db.listings.save(l);
  });
};
