import type { Transaction as DbTransaction } from "@prisma/client";
import type { CategoryId, Transaction } from "./types";

/** Map a Prisma transaction row to the client-facing shape. */
export function txToClient(t: DbTransaction): Transaction {
  return {
    id: t.id,
    amount: t.amount,
    category: t.category as CategoryId,
    type: t.type === "income" ? "income" : "expense",
    merchant: t.merchant,
    note: t.note,
    date: t.date,
    createdAt: t.createdAt.getTime(),
  };
}
