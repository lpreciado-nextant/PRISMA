import { useEffect, useState } from "react";
import { getContext } from "@microsoft/power-apps/app";

export interface AppUser {
  fullName: string;
  userPrincipalName: string;
  photoUrl?: string;
  /** False when running outside the Power Apps host (plain `npm run dev`). */
  live: boolean;
}

const FALLBACK: AppUser = {
  fullName: "Luis David Preciado",
  userPrincipalName: "lpreciado@nextant.com",
  live: false,
};

/**
 * Reads the signed-in user from the Power Apps host. Falls back to a demo
 * identity so the app still renders outside the host during design work.
 */
export function useAppUser(): AppUser {
  const [user, setUser] = useState<AppUser>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));

    Promise.race([getContext(), timeout])
      .then((ctx) => {
        if (cancelled || !ctx?.user?.fullName) return;
        setUser({
          fullName: ctx.user.fullName,
          userPrincipalName: ctx.user.userPrincipalName ?? FALLBACK.userPrincipalName,
          live: true,
        });
      })
      .catch(() => {
        /* not hosted by Power Apps — keep the fallback identity */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
