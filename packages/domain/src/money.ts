import { z } from "zod";

/** Money is integer minor units (poisha) + currency. Never float. */
export const Money = z.object({
  amount: z.number().int(),
  currency: z.string().length(3).default("BDT"),
});
export type Money = z.infer<typeof Money>;

export const money = (amount: number, currency = "BDT"): Money => {
  if (!Number.isInteger(amount)) throw new Error("amount must be integer minor units");
  return { amount, currency };
};

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error("currency mismatch");
  return { amount: a.amount + b.amount, currency: a.currency };
};
