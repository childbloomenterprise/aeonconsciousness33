export async function prepareOfflineShell() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator))
    throw new Error(
      "This browser cannot prepare the app offline. Try a current browser over HTTPS.",
    );
  let readyTimer: ReturnType<typeof setTimeout>;
  const registration = await Promise.race([
    (async () => {
      await navigator.serviceWorker.register("/sw.js");
      return navigator.serviceWorker.ready;
    })(),
    new Promise<never>((_, reject) => {
      readyTimer = setTimeout(
        () =>
          reject(
            new Error(
              "Could not finish downloading the app. Stay connected and retry.",
            ),
          ),
        30000,
      );
    }),
  ]).finally(() => clearTimeout(readyTimer));
  if (!registration.active)
    throw new Error("The app is still preparing. Please retry in a moment.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          "Could not finish downloading the app. Stay connected and retry.",
        ),
      );
    }, 30000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data?.ready) resolve();
      else
        reject(
          new Error(
            "Some app files could not be saved. Stay connected and retry.",
          ),
        );
    };
    registration.active!.postMessage({ type: "PREPARE_JOURNEY_SHELL" }, [
      channel.port2,
    ]);
  });
}
