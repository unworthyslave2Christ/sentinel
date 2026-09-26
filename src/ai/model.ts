import { gateway } from "ai";

const DEFAULT_MODEL = "mistral/mistral-small-latest";

export function getModel() {
  const modelId = process.env.AI_MODEL || DEFAULT_MODEL;

  return gateway(modelId);
}

export function modelName() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}