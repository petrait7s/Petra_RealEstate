import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { Property, Listing } from "@petra/domain";
import { z } from "zod";
import { db } from "../../db.js";
import { tid } from "../../store.js";

const CreateProperty = Property.omit({ id: true, tenantId: true });
const CreateListing = Listing.omit({ id: true, tenantId: true });

export const propertiesModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const p: Property = { ...CreateProperty.parse(req.body), id: randomUUID(), tenantId: tid(req) };
    return reply.code(201).send(db.properties.add(p));
  });
  app.get("/", async (req) => db.properties.list(tid(req)));
};

export const listingsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const body = CreateListing.parse(req.body);
    if (!db.properties.get(t, body.propertyId)) return reply.code(404).send({ error: "property not found" });
    return reply.code(201).send(db.listings.add({ ...body, id: randomUUID(), tenantId: t }));
  });
  app.get("/", async (req) => db.listings.list(tid(req)));
  app.post<{ Params: { id: string } }>("/:id/status", async (req, reply) => {
    const l = db.listings.get(tid(req), req.params.id);
    if (!l) return reply.code(404).send({ error: "not found" });
    l.status = z.object({ status: Listing.shape.status }).parse(req.body).status;
    return l;
  });
};
