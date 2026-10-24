import { getGetUserInfoQueryKey } from "@workspace/api-client-react";

export function getUserInfoKey(token?: string | null): readonly unknown[] {
  const base = getGetUserInfoQueryKey();
  return token ? [...base, token] : base;
}