import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type Context as ReactContext,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { Journey, JourneyEvent, ProfileState } from "../shared/contracts";
import { request, supabase } from "./lib/client";
import {
  offlineJourneys,
  offlineChanged,
  readOfflineOwner,
  rememberOfflineOwner,
  networkFailure,
  type OfflineAccount,
  type PendingEntry,
} from "./lib/offline";
import { localAppMirror } from "./lib/localApp";
import type { Conversation } from "../shared/contracts";
import { prepareOfflineShell } from "./lib/offlineShell";

const emptyProfile: ProfileState = {
  display_name: "",
  profile: null,
  consents: { sensitive_storage: false, external_ai: false },
};
type LincState = {
  session: Session | null;
  signedIn: boolean;
  preview: boolean;
  authReady: boolean;
  authConfigured: boolean;
  journeys: Journey[];
  activeJourney: Journey | null;
  selectedJourney: Journey | null;
  selectJourney: (id: string) => void;
  events: JourneyEvent[];
  profile: ProfileState;
  busy: boolean;
  dataError: Error | null;
  notice: string | null;
  recovery: boolean;
  call: <T>(route: string, method?: string, body?: unknown) => Promise<T>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  signOut: () => Promise<void>;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;
  completeRecovery: () => void;
  online: boolean;
  offline: {
    account: OfflineAccount | null;
    syncing: boolean;
    deviceSyncing?: boolean;
    deviceError?: string;
    prepare: (journey: Journey) => Promise<void>;
    remove: (journeyId: string) => Promise<void>;
    sync: () => Promise<void>;
    resolve: (entry: PendingEntry, choice: "server" | "copy") => Promise<void>;
  };
};
const Context: ReactContext<LincState | null> =
  import.meta.hot?.data?.context || createContext<LincState | null>(null);
import.meta.hot?.dispose?.((data) => {
  data.context = Context;
});
const isPreview =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "1";
let previewAPI: Promise<typeof import("./lib/preview")> | null = null;
export function LincProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [offlineOwner, setOfflineOwner] = useState<string | null>(() =>
    readOfflineOwner(),
  );
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [networkLost, setNetworkLost] = useState(false);
  const [offlineAccount, setOfflineAccount] = useState<OfflineAccount | null>(
    null,
  );
  const [syncing, setSyncing] = useState(false);
  const [deviceSyncing, setDeviceSyncing] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const userRef = useRef<string | null>(null);
  const scope = isPreview
    ? "preview"
    : session?.user.id || offlineOwner || "guest";
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  useEffect(() => {
    const update = () => {
      setBrowserOnline(navigator.onLine);
      if (navigator.onLine) setNetworkLost(false);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    const load = () => {
      if (scope === "guest" || isPreview) {
        setOfflineAccount(null);
        return;
      }
      void offlineJourneys
        .read(scope)
        .then((account) => {
          if (!disposed) setOfflineAccount(account || null);
        })
        .catch(() => {
          if (!disposed) setOfflineAccount(null);
        });
    };
    load();
    window.addEventListener(offlineChanged, load);
    return () => {
      disposed = true;
      window.removeEventListener(offlineChanged, load);
    };
  }, [scope]);
  const [selectedJourneyId, selectJourney] = useState<string | null>(() =>
    (() => {
      try {
        return (
          new URLSearchParams(window.location.search).get("journey") ||
          sessionStorage.getItem("linc-selected-journey")
        );
      } catch {
        return null;
      }
    })(),
  );
  useEffect(() => {
    try {
      if (selectedJourneyId)
        sessionStorage.setItem("linc-selected-journey", selectedJourneyId);
      else sessionStorage.removeItem("linc-selected-journey");
    } catch {
      /* optional storage */
    }
  }, [selectedJourneyId]);
  const [authReady, setReady] = useState(!supabase);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [recovery, setRecovery] = useState(
    new URLSearchParams(window.location.hash.slice(1)).get("type") ===
      "recovery",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const onboardingPromptedRef = useRef(false);
  useEffect(() => {
    if (!supabase) return;
    const restore = () => {
      if (!navigator.onLine) {
        setReady(true);
        void supabase!.auth.stopAutoRefresh();
        return;
      }
      void supabase!.auth.startAutoRefresh();
      void supabase!.auth
        .getSession()
        .then(({ data }) => {
          const remembered = readOfflineOwner();
          if (
            data.session &&
            remembered &&
            remembered !== data.session.user.id
          ) {
            rememberOfflineOwner(null);
            void offlineJourneys.clear(remembered).catch(() => {});
          }
          userRef.current = data.session?.user.id || null;
          setSession(data.session);
          if (data.session) setOfflineOwner(null);
          setReady(true);
        })
        .catch(() => {
          setReady(true);
          setNotice("Could not restore your session. Please sign in again.");
        });
    };
    restore();
    window.addEventListener("online", restore);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      const remembered = readOfflineOwner();
      if (newSession && remembered && remembered !== newSession.user.id) {
        rememberOfflineOwner(null);
        void offlineJourneys.clear(remembered).catch(() => {});
      }
      const previous = userRef.current;
      if (previous && newSession && previous !== newSession.user.id)
        void offlineJourneys.clear(previous).catch(() => {});
      userRef.current = newSession?.user.id || null;
      setSession(newSession);
      if (newSession) setOfflineOwner(null);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setAuthOpen(true);
      }
      if (event === "SIGNED_OUT") {
        const owner = previous || readOfflineOwner();
        if (owner) void offlineJourneys.clear(owner).catch(() => {});
        setOfflineOwner(null);
        setOfflineAccount(null);
        try {
          Object.keys(sessionStorage)
            .filter((key) => key.startsWith("linc-entry-draft:"))
            .forEach((key) => sessionStorage.removeItem(key));
        } catch {
          /* optional storage */
        }
        selectJourney(null);
        queryClient.clear();
        onboardingPromptedRef.current = false;
      }
    });
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", restore);
    };
  }, [queryClient]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const call = useCallback(
    async <T,>(route: string, method?: string, body?: unknown): Promise<T> => {
      if (isPreview) {
        if (import.meta.env.DEV) {
          previewAPI ||= import("./lib/preview");
          return (await previewAPI).previewRequest<T>(route, method, body);
        }
      }
      const owner = scope;
      const verb = method || "GET";
      const [path, search = ""] = route.split("?");
      const journeyId = new URLSearchParams(search).get("journey_id");
      const saved =
        owner !== "guest"
          ? await offlineJourneys.read(owner).catch(() => undefined)
          : undefined;
      const cached = async (): Promise<T> => {
        if (!saved)
          throw new Error(
            "Your account has not finished saving to this phone yet. Open LINC-33 while connected to finish automatic setup.",
          );
        if (path === "journeys")
          return (await offlineJourneys.journeys(owner)) as T;
        if (path === "events" && journeyId)
          return (await offlineJourneys.events(owner, journeyId)) as T;
        if (path === "health-context")
          return (saved.snapshots?.["health-context"] || saved.profile) as T;
        if (path === "conversations") {
          const id = new URLSearchParams(search).get("id");
          if (id)
            return (saved.snapshots?.[`conversations?id=${id}`] || []) as T;
          const list = (saved.snapshots?.conversations || []) as Conversation[];
          return (
            journeyId ? list.filter((c) => c.journey_id === journeyId) : list
          ) as T;
        }
        throw new Error(
          "This feature needs a connection. Your saved journey and text entries are available offline.",
        );
      };
      const enqueue = async (): Promise<T> => {
        const input = body as Parameters<typeof offlineJourneys.enqueue>[2];
        const result = await offlineJourneys.enqueue(
          owner,
          verb as "POST" | "PATCH",
          input,
        );
        return result as T;
      };
      // Persistent local data is the first read, including while online.
      if (
        verb === "GET" &&
        saved &&
        (path === "health-context" ||
          (path === "journeys" && Object.keys(saved.bundles).length > 0) ||
          (path === "events" && journeyId && saved.bundles[journeyId]) ||
          (path === "conversations" && saved.snapshots?.conversations))
      )
        return cached();
      // Text writes commit to IndexedDB first; the existing queue syncs them online.
      if (path === "events" && saved && (verb === "POST" || verb === "PATCH"))
        return enqueue();
      if (!navigator.onLine || (!session && !!offlineOwner)) {
        if (verb === "GET") return cached();
        if (path === "events" && (verb === "POST" || verb === "PATCH"))
          return enqueue();
        throw new Error(
          "This account change needs internet. Your locally saved journeys, history and text logs remain available.",
        );
      }
      try {
        const result = await request<T>(
          route,
          method,
          body,
          owner === "guest" ? undefined : owner,
        );
        if (scopeRef.current !== owner)
          throw new Error("Your account changed. Please retry.");
        setNetworkLost(false);
        if (
          path === "privacy" &&
          (verb === "DELETE" ||
            ((body as { consent_type?: string; granted?: boolean })
              ?.consent_type === "sensitive_storage" &&
              (body as { granted?: boolean }).granted === false))
        )
          await offlineJourneys.clear(owner);
        if (saved && verb === "GET") {
          if (path === "journeys")
            await offlineJourneys
              .reconcile(owner, result as Journey[])
              .catch(() => {});
          if (
            path === "health-context" &&
            !(result as ProfileState).consents.sensitive_storage
          )
            await offlineJourneys.clear(owner);
          if (path === "events" && journeyId && saved.bundles[journeyId]) {
            try {
              await offlineJourneys.updateEvents(
                owner,
                journeyId,
                result as JourneyEvent[],
              );
              return (await offlineJourneys.events(owner, journeyId)) as T;
            } catch {
              /* An unavailable offline cache must not hide a successful online read. */
            }
          }
        }
        return result;
      } catch (error) {
        if (networkFailure(error)) {
          setNetworkLost(true);
          if (verb === "GET") return cached();
          if (
            path === "events" &&
            saved &&
            (verb === "POST" || verb === "PATCH")
          )
            return enqueue();
        }
        if ((error as { status?: number }).status === 401) setAuthOpen(true);
        throw error;
      }
    },
    [scope, session?.user.id, offlineOwner],
  );
  const enabled = !!session || isPreview || !!offlineOwner;
  const journeys = useQuery({
    networkMode: "always",
    queryKey: [scope, "journeys"],
    queryFn: () => call<Journey[]>("journeys"),
    enabled,
    retry: false,
  });
  const profile = useQuery({
    networkMode: "always",
    queryKey: [scope, "profile"],
    queryFn: () => call<ProfileState>("health-context"),
    enabled,
    retry: false,
  });
  const activeJourney =
    journeys.data?.find((j) => j.status === "active") || null;
  const selectedJourney =
    journeys.data?.find((j) => j.id === selectedJourneyId) ||
    activeJourney ||
    journeys.data?.[0] ||
    null;
  const events = useQuery({
    networkMode: "always",
    queryKey: [scope, "events", selectedJourney?.id],
    queryFn: () =>
      call<JourneyEvent[]>(`events?journey_id=${selectedJourney!.id}`),
    enabled: enabled && !!selectedJourney,
    retry: false,
  });
  useEffect(() => {
    if (!session || isPreview || recovery || !browserOnline || networkLost)
      return;
    if (!profile.data?.signup || onboardingPromptedRef.current) return;
    let skipped = false;
    try {
      skipped =
        sessionStorage.getItem(
          `linc-preferences-skipped:${session.user.id}`,
        ) === "1";
    } catch {
      /* optional */
    }
    if (!profile.data.signup?.onboarded && !skipped) {
      onboardingPromptedRef.current = true;
      setOnboardingOpen(true);
    }
  }, [session, profile.data, recovery, browserOnline, networkLost]);
  const syncOffline = useCallback(async () => {
    if (!session || !navigator.onLine || isPreview) return;
    const owner = session.user.id;
    setSyncing(true);
    try {
      // Recheck current server consent before sending anything queued offline.
      const current = await request<ProfileState>(
        "health-context",
        "GET",
        undefined,
        owner,
      );
      if (userRef.current !== owner) return;
      if (!current.consents.sensitive_storage) {
        await offlineJourneys.clear(owner);
        return;
      }
      await offlineJourneys.flush(
        owner,
        (route, method, body) => request(route, method, body, owner),
        () => userRef.current === owner && navigator.onLine,
      );
      setNetworkLost(false);
      await queryClient.invalidateQueries({ queryKey: [owner] });
    } catch (error) {
      if (networkFailure(error)) setNetworkLost(true);
      else if ((error as { status?: number }).status === 401) setAuthOpen(true);
    } finally {
      setSyncing(false);
    }
  }, [session, queryClient]);
  useEffect(() => {
    if (session && browserOnline && !isPreview)
      void queryClient.invalidateQueries({ queryKey: [session.user.id] });
  }, [session?.user.id, browserOnline, queryClient]);
  useEffect(() => {
    if (
      !session ||
      !browserOnline ||
      !offlineAccount ||
      !offlineAccount.queue.some((item) => item.state === "pending")
    )
      return;
    void syncOffline();
    const timer = window.setInterval(() => void syncOffline(), 30000);
    return () => window.clearInterval(timer);
  }, [
    session?.user.id,
    browserOnline,
    offlineAccount?.queue
      .filter((item) => item.state === "pending")
      .map((item) => item.id)
      .join(","),
    syncOffline,
  ]);
  const syncDevice = useCallback(
    async (fresh = false) => {
      if (!session || !navigator.onLine || isPreview) return;
      const owner = session.user.id;
      setDeviceSyncing(true);
      setDeviceError("");
      try {
        await localAppMirror.sync(
          owner,
          (route, method, body) => request(route, method, body, owner),
          () => userRef.current === owner && navigator.onLine,
          fresh,
        );
        if (userRef.current === owner)
          await queryClient.invalidateQueries({ queryKey: [owner] });
      } catch (error) {
        if (userRef.current === owner)
          setDeviceError(
            (error as Error).message ||
              "Device update interrupted. Your saved data remains available.",
          );
      } finally {
        if (userRef.current === owner) setDeviceSyncing(false);
      }
    },
    [session?.user.id, queryClient],
  );
  useEffect(() => {
    if (!session || !browserOnline || isPreview) return;
    void syncDevice();
    const resume = () => {
      if (document.visibilityState === "visible") void syncDevice();
    };
    document.addEventListener("visibilitychange", resume);
    const interval = window.setInterval(() => void syncDevice(), 60000);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.clearInterval(interval);
    };
  }, [session?.user.id, browserOnline, syncDevice]);
  const prepareOffline = async (journey: Journey) => {
    if (!session || !navigator.onLine)
      throw new Error("Connect and sign in to prepare this journey.");
    const owner = session.user.id;
    const [latestJourneys, latestEvents, currentProfile] = await Promise.all([
      request<Journey[]>("journeys", "GET", undefined, owner),
      request<JourneyEvent[]>(
        `events?journey_id=${journey.id}`,
        "GET",
        undefined,
        owner,
      ),
      request<ProfileState>("health-context", "GET", undefined, owner),
      prepareOfflineShell(),
    ]);
    if (userRef.current !== owner)
      throw new Error("Your account changed. Please retry.");
    const currentJourney = latestJourneys.find(
      (item) => item.id === journey.id,
    );
    if (!currentJourney)
      throw new Error("This journey is no longer available.");
    await offlineJourneys.prepare(
      owner,
      currentJourney,
      latestEvents,
      currentProfile,
    );
    await navigator.storage?.persist?.().catch(() => false);
    setNotice("Journey ready offline on this device.");
  };
  const refresh = async () => {
    await syncDevice(true);
    await queryClient.invalidateQueries();
  };
  return (
    <Context.Provider
      value={{
        session,
        signedIn: enabled,
        preview: isPreview,
        online: browserOnline && !networkLost && (!!session || !offlineOwner),
        offline: {
          account: offlineAccount?.id === scope ? offlineAccount : null,
          syncing,
          deviceSyncing,
          deviceError,
          prepare: prepareOffline,
          remove: async (journeyId) => {
            await offlineJourneys.remove(scope, journeyId);
            await queryClient.invalidateQueries({ queryKey: [scope] });
          },
          sync: async () => {
            await offlineJourneys.retry(scope);
            await syncOffline();
            await syncDevice();
          },
          resolve: async (operation, choice) => {
            if (!session || !navigator.onLine)
              throw new Error("Reconnect to review and resolve this entry.");
            const owner = session.user.id;
            const serverEvents = await request<JourneyEvent[]>(
              `events?journey_id=${operation.journeyId}`,
              "GET",
              undefined,
              owner,
            );
            if (userRef.current !== owner) return;
            if (choice === "copy") {
              // A separate entry preserves both versions without overwriting the server.
              await offlineJourneys.enqueue(owner, "POST", {
                journey_id: operation.journeyId,
                request_id: crypto.randomUUID(),
                event: operation.event,
              });
            }
            await offlineJourneys.useServer(owner, operation.id, serverEvents);
            await syncOffline();
            await queryClient.invalidateQueries({ queryKey: [owner] });
          },
        },
        authReady,
        authConfigured: !!supabase,
        journeys: journeys.data || [],
        activeJourney,
        selectedJourney,
        selectJourney,
        events: events.data || [],
        profile: profile.data || emptyProfile,
        busy: journeys.isFetching || profile.isFetching || events.isFetching,
        dataError: journeys.error || profile.error || events.error,
        notice,
        recovery,
        call,
        refresh,
        notify: setNotice,
        signOut: async () => {
          const owners = new Set(
            [session?.user.id, offlineOwner, readOfflineOwner()].filter(
              (id): id is string => !!id,
            ),
          );
          rememberOfflineOwner(null);
          userRef.current = null;
          await Promise.all(
            [...owners].map((owner) => offlineJourneys.clear(owner)),
          );
          setOfflineOwner(null);
          setOfflineAccount(null);
          setSession(null);
          if (supabase) await supabase.auth.signOut({ scope: "local" });
          queryClient.clear();
          setRecovery(false);
        },
        authOpen,
        setAuthOpen,
        onboardingOpen,
        setOnboardingOpen: (open) => {
          if (!open && session) {
            try {
              sessionStorage.setItem(
                `linc-preferences-skipped:${session.user.id}`,
                "1",
              );
            } catch {
              /* optional */
            }
          }
          setOnboardingOpen(open);
        },
        completeRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLinc() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing Linc provider");
  return context;
}
