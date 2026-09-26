import { gateway } from "ai";

const MODEL =
  process.env.AI_MODEL ||
  "mistral/mistral-small-latest";

export function getModel() {
  return gateway(MODEL);
}