import { Link } from "react-router-dom";
export function Policies({ kind }: { kind: "privacy" | "terms" }) {
  return (
    <article className="page policy-page">
      <span className="eyebrow">ADULT PILOT · VERSION 2026-10-24</span>
      <h1>
        {kind === "privacy"
          ? "Your privacy, along the way."
          : "Pilot terms of use."}
      </h1>
      {kind === "privacy" ? (
        <>
          <h2>What you choose to share</h2>
          <p>
            Account services use your email and authentication details.
            Journeys, conversations, reported events, optional health details
            and an optional emergency contact are stored in the configured
            Supabase project. Private record storage and external AI processing
            have separate consent choices in Profile. Declining private storage
            leaves general source information and emergency access available.
          </p>
          <h2>Where information goes</h2>
          <p>
            With external AI consent, travel messages and voice recordings go to
            the configured Google Gemini service for travel conversation,
            transcription, translation and factual extraction. Speech in
            Malayalam, Hindi, Tamil, Kannada, Telugu or English is translated,
            and only the English text is saved to your journey. Saved health
            profiles are excluded from Gemini context. Health responses use
            curated general information and reported records. Sensitive
            processing stays disabled until the pilot administrator configures
            the provider appropriately. Provider processing and retention follow
            its applicable terms; the app cannot promise immediate deletion from
            provider systems.
          </p>
          <p>
            A chosen location or town goes to Google Places when you search
            nearby services. An interactive map loads Google Maps on demand.
            Precise location is requested only for that feature; this app does
            not track you in the background. Google’s{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>{" "}
            applies to Google services.
          </p>
          <h2>Storage and deletion</h2>
          <p>
            With private storage enabled, signed-in journeys, entries, profile
            details and conversation history are automatically copied to this
            browser's local database. App screens are also stored on this
            device. These local copies let you open the app and read your saved
            data offline. Text entries save here first and sync when connected.
            Initial account downloads and background updates require internet
            and an open app. Signing out or revoking private storage removes
            local account copies and unsynced entries. Device/browser storage
            can be cleared or evicted.
          </p>
          <p>
            Guest conversations stay in memory until you leave or refresh. New
            guest conversations are not automatically saved on this device.
            Older device-saved history remains available for deletion and is not
            uploaded when you sign in.
          </p>
          <p>
            Private records remain until you delete them. Delete individual
            entries, conversations or journeys through their screens, and your
            profile or account through Profile. Deleting a conversation removes
            events extracted from its messages; deleting a journey removes its
            related records. Revoking consent prevents new processing or saving
            and does not erase earlier records. Account deletion requires the
            configured administrator service; if unavailable, contact your
            invitation sender.
          </p>
          <p>
            Raw audio is held temporarily in browser memory for transcription
            and translation, then released. Only the resulting English text is
            saved; the recording itself is not retained. No audio files or
            medical message contents are placed in operational logs. App-shell
            caching excludes authenticated API responses and health records.
            Authentication tokens may be stored by Supabase in your browser to
            maintain your session; sign out on shared devices.
          </p>
          <h2>Contact and pilot review</h2>
          <p>
            Contact the sender of your pilot invitation for data requests or
            questions. Administrator: supply your operator identity, support
            contact, retention policy and jurisdictional review before
            processing real participants’ sensitive information. This pilot
            notice has not undergone legal review.
          </p>
        </>
      ) : (
        <>
          <h2>Who this pilot serves</h2>
          <p>
            LINC-33 is a travel companion for adults aged 18 or older in India.
            Use your own account and accurate reported information. Do not use
            it for another person’s medical assessment, illegal activity or
            attempts to access other accounts. Features depend on configured
            services, connectivity and conservative usage limits.
          </p>
          <h2>Health information and urgent help</h2>
          <p>
            Linked general information and warning-sign prompts cannot diagnose,
            identify the cause of illness, prescribe treatment or replace a
            healthcare professional. Screening rules have not been clinically
            validated and may miss warning signs. Seek professional help when
            needed, even if no warning appears. Emergency links open a device
            dialer and do not dispatch assistance. Choose your actual
            jurisdiction before using displayed emergency numbers.
          </p>
          <h2>Nearby and regional food information</h2>
          <p>
            Google Places supplies place results; details can be missing or
            change. Distances are approximate straight-line calculations.
            Regional dish descriptions do not confirm a restaurant’s menu,
            actual ingredients or allergy safety. Google Maps services are
            subject to the{" "}
            <a
              href="https://cloud.google.com/maps-platform/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps Platform Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <h2>Your data and available controls</h2>
          <p>
            See the <Link to="/privacy">privacy notice</Link> for consent,
            processing and deletion choices. The pilot administrator may suspend
            invitations or service access. No payments or subscriptions are
            implemented in this pilot. Contact your invitation sender for
            support. Administrator review is required before public launch.
          </p>
        </>
      )}
      <div className="public-policy-links">
        <Link to="/">Head home</Link>
        <Link to={kind === "privacy" ? "/terms" : "/privacy"}>
          {kind === "privacy" ? "Terms of use" : "Privacy notice"}
        </Link>
      </div>
    </article>
  );
}
