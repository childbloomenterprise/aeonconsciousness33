import { z } from "zod";

export const eventTypes = [
  "meal",
  "symptom",
  "activity",
  "medication_report",
  "hydration",
  "note",
] as const;
export const eventType = z.enum(eventTypes);
export const uuid = z.uuid();
export const timezone = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone");
export const consentTypes = ["sensitive_storage", "external_ai"] as const;
export const eventDraft = z
  .object({
    event_type: eventType,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(2000).nullable().default(null),
    occurred_at: z.iso.datetime({ offset: true }).nullable().default(null),
    time_text: z.string().max(160).nullable().default(null),
    timezone: timezone.default("Asia/Kolkata"),
    location_name: z.string().max(200).nullable().default(null),
    confidence: z.number().min(0).max(1).default(1),
    metadata_json: z
      .object({
        amount_ml: z.number().min(0).max(20000).optional(),
        approximate: z.boolean().optional(),
      })
      .default({}),
  })
  .strict();
export const journeyInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    destination_name: z.string().trim().min(1).max(160),
    started_at: z.iso.datetime({ offset: true }),
    ended_at: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .refine(
    (x) => !x.ended_at || Date.parse(x.ended_at) >= Date.parse(x.started_at),
    "End date must follow start date",
  );
export const chatInput = z
  .object({
    text: z.string().trim().min(1).max(4000),
    request_id: uuid,
    conversation_id: uuid.nullable().default(null),
    journey_id: uuid.nullable().default(null),
    timezone: timezone.default("Asia/Kolkata"),
  })
  .strict();
export const healthInput = z
  .object({
    display_name: z.string().trim().max(100),
    age_range: z.enum(["18–29", "30–44", "45–59", "60+"]).nullable(),
    blood_group: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .nullable(),
    allergies: z.array(z.string().max(100)).max(30),
    medical_conditions: z.array(z.string().max(100)).max(30),
    current_medications: z.array(z.string().max(100)).max(30),
    emergency_contact: z
      .object({
        name: z.string().max(100),
        phone: z.string().regex(/^\+?[\d ()-]{7,25}$/),
        relationship: z.string().max(80),
      })
      .nullable(),
  })
  .strict();
/** Interests offered in the signup questionnaire. Free values are rejected. */
export const interestOptions = [
  "trekking",
  "beaches",
  "backwaters",
  "temples & heritage",
  "street food",
  "wildlife",
  "ayurveda & wellness",
  "photography",
  "hill stations",
  "cities & nightlife",
] as const;
export const dietaryOptions = [
  "vegetarian",
  "non_vegetarian",
  "vegan",
  "pescatarian",
  "no_preference",
] as const;
export const allergyOptions = [
  "none",
  "peanuts",
  "tree nuts",
  "shellfish",
  "fish",
  "dairy",
  "gluten",
  "eggs",
  "soy",
  "sesame",
] as const;
/** The signup questionnaire: seven answers plus the two consent choices. */
export const signupInput = z
  .object({
    display_name: z.string().trim().min(1).max(100),
    date_of_birth: z.iso.date(),
    sex: z.enum(["male", "female"]),
    allergies: z.array(z.enum(allergyOptions)).max(allergyOptions.length),
    dietary_preference: z.enum(dietaryOptions),
    interests: z
      .array(z.enum(interestOptions))
      .min(1)
      .max(interestOptions.length),
    emergency_contact: z
      .object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().regex(/^\+?[\d ()-]{7,25}$/),
        relationship: z.string().max(80).default(""),
      })
      .nullable(),
    adult: z.literal(true),
    storage_consent: z.boolean(),
    ai_consent: z.boolean(),
  })
  .strict()
  .refine(
    (x) => {
      const today = new Date();
      const birth = new Date(`${x.date_of_birth}T00:00:00Z`);
      let age = today.getUTCFullYear() - birth.getUTCFullYear();
      if (
        today.getUTCMonth() < birth.getUTCMonth() ||
        (today.getUTCMonth() === birth.getUTCMonth() &&
          today.getUTCDate() < birth.getUTCDate())
      )
        age--;
      return Number.isFinite(birth.getTime()) && age >= 18 && age <= 130;
    },
    {
      message: "This service is for adults aged 18 or older.",
      path: ["date_of_birth"],
    },
  )
  .refine((x) => !x.allergies.includes("none") || x.allergies.length === 1, {
    message: "Choose no allergies or specific allergies, not both.",
    path: ["allergies"],
  })
  .refine((x) => !x.emergency_contact || x.storage_consent, {
    message:
      "An emergency contact is private storage, so it needs private storage enabled",
  });
export type SignupInput = z.infer<typeof signupInput>;
export type EventDraft = z.infer<typeof eventDraft>;
export type EventType = (typeof eventTypes)[number];
export type Urgency = "none" | "routine" | "seek_care" | "emergency";
export type ConsentType = (typeof consentTypes)[number];
export type HealthProfileInput = z.infer<typeof healthInput>;
export interface Journey extends z.infer<typeof journeyInput> {
  id: string;
  user_id: string;
  status: "active" | "completed";
  created_at: string;
}
export interface JourneyEvent extends EventDraft {
  id: string;
  updated_at?: string;
  journey_id: string;
  user_id: string;
  created_at: string;
  source_message_id: string | null;
}
export interface Source {
  id: string;
  topic: string;
  title: string;
  organization: string;
  url: string;
  summary: string;
  verified_at: string;
  license_status: string;
  review_status: string;
}
export type Action = {
  type: "view_timeline" | "nearby" | "sos" | "start_journey";
  label: string;
};
export interface ChatResult {
  guidance?: {
    reason: string;
    cause: string;
    personalised_support: string;
    immediate_suggestion: string;
  };
  reply: string;
  intent: string;
  conversation_id: string | null;
  events: Array<{
    status: "saved" | "pending" | "failed";
    event: EventDraft & { id?: string };
  }>;
  medical_context: {
    contains_health_guidance: boolean;
    urgency: Urgency;
    source_ids: string[];
  };
  actions: Action[];
  recent_events?: JourneyEvent[];
  historical_events?: JourneyEvent[];
  persistence_error?: string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  result?: ChatResult;
}
export interface Conversation {
  id: string;
  journey_id: string | null;
  created_at: string;
  updated_at: string;
  title?: string;
}
export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  open_now?: boolean;
  distance_km?: number;
  maps_url: string;
  /** Set only on the labelled Munnar demonstration points. */
  demo?: boolean;
  attribution?: string;
  attributions?: Array<{ provider: string; uri?: string }>;
}
export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at: string;
}
/** Non-clinical questionnaire answers, readable without health-storage consent. */
export interface SignupState {
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  interests: string[];
  dietary_preference: string | null;
  onboarded: boolean;
}
export interface ProfileState {
  profile: HealthProfileInput | null;
  display_name: string;
  signup?: SignupState;
  consents: Record<ConsentType, boolean>;
}
export const actionSchema = z.object({
  type: z.enum(["view_timeline", "nearby", "sos", "start_journey"]),
  label: z.string().max(80),
});
export const guidanceSchema = z
  .object({
    reason: z.string().max(1600),
    cause: z.string().max(1000),
    personalised_support: z.string().max(1600),
    immediate_suggestion: z.string().max(1000),
  })
  .strict();
export const photoInput = z
  .object({
    image: z.string().min(1).max(4200000),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();
export const photoResult = z
  .object({
    text: z.string().min(1).max(2000),
    uncertainty: z.string().max(600),
  })
  .strict();
export const extractionSchema = z
  .object({
    reply: z.string().max(2400),
    guidance: guidanceSchema.optional(),
    intent: z.enum(["travel", "logging", "nearby", "health", "other"]),
    events: z.array(eventDraft).max(6),
    actions: z.array(actionSchema).max(3),
  })
  .strict();

export const journeySchema = journeyInput
  .safeExtend({
    id: uuid,
    user_id: uuid,
    status: z.enum(["active", "completed"]),
    created_at: z.iso.datetime({ offset: true }),
  })
  .passthrough();
export const journeyEventSchema = eventDraft
  .extend({
    id: uuid,
    journey_id: uuid,
    user_id: uuid,
    created_at: z.iso.datetime({ offset: true }),
    source_message_id: uuid.nullable(),
  })
  .passthrough();
export const chatResultSchema = z
  .object({
    reply: z.string().max(6000),
    guidance: guidanceSchema.optional(),
    intent: z.enum(["travel", "logging", "nearby", "health", "other"]),
    conversation_id: uuid.nullable(),
    events: z
      .array(
        z.object({
          status: z.enum(["saved", "pending", "failed"]),
          event: eventDraft.extend({ id: uuid.optional() }).passthrough(),
        }),
      )
      .max(12),
    medical_context: z.object({
      contains_health_guidance: z.boolean(),
      urgency: z.enum(["none", "routine", "seek_care", "emergency"]),
      source_ids: z.array(z.string().max(100)).max(10),
    }),
    actions: z.array(actionSchema).max(6),
    recent_events: z.array(journeyEventSchema).max(30).optional(),
    historical_events: z.array(journeyEventSchema).max(10).optional(),
    persistence_error: z.string().max(500).optional(),
  })
  .strict();
export const placeSchema = z.object({
  id: z.string().max(400),
  name: z.string().max(500),
  address: z.string().max(1000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().max(100).optional(),
  open_now: z.boolean().optional(),
  distance_km: z.number().nonnegative().optional(),
  maps_url: z
    .url()
    .refine((value) => new URL(value).hostname === "www.google.com"),
  /** True only for the labelled Munnar demonstration points. */
  demo: z.boolean().optional(),
  attribution: z.string().max(2000).optional(),
  attributions: z
    .array(
      z.object({
        provider: z.string().max(500),
        uri: z
          .url()
          .refine((value) => new URL(value).protocol === "https:")
          .optional(),
      }),
    )
    .max(30)
    .optional(),
});
const messageSchema = z.object({
  id: uuid,
  role: z.enum(["user", "assistant"]),
  content: z.string().max(6000),
  created_at: z.iso.datetime({ offset: true }),
  result: chatResultSchema.nullable().optional(),
});
const conversationSchema = z.object({
  id: uuid,
  journey_id: uuid.nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  title: z.string().optional(),
});
const success = z.object({ success: z.literal(true) });
export function responseSchema(route: string, method: string) {
  if (route.split("?")[0] === "photo") return photoResult;
  const [path, query = ""] = route.split("?");
  if (path === "chat") return chatResultSchema;
  if (path === "transcribe")
    return z.object({
      // English, regardless of the language spoken into the microphone.
      text: z.string().min(1).max(4000),
      original: z.string().max(4000).optional(),
      language: z.string().max(60).optional(),
    });
  if (path === "nearby") return z.array(placeSchema).max(12);
  if (path === "status")
    return z.object({
      auth: z.boolean(),
      ai: z.boolean(),
      private_ai: z.boolean(),
      voice_ai: z.boolean().optional(),
      nearby: z.boolean(),
      /** Nearby is serving labelled Munnar sample points rather than a provider. */
      nearby_demo: z.boolean().optional(),
      account_deletion: z.boolean(),
    });
  if (path === "journeys")
    return method === "GET"
      ? z.array(journeySchema)
      : method === "DELETE"
        ? success
        : journeySchema;
  if (path === "events")
    return method === "GET"
      ? z.array(journeyEventSchema)
      : method === "DELETE"
        ? success
        : journeyEventSchema;
  if (path === "onboarding")
    return z.object({
      success: z.literal(true),
      storage_saved: z.boolean(),
      age_range: z.string().max(10),
    });
  if (path === "health-context")
    return method === "GET"
      ? z.object({
          display_name: z.string().max(100),
          profile: healthInput.passthrough().nullable(),
          signup: z
            .object({
              date_of_birth: z.string().max(20).nullable(),
              sex: z.enum(["male", "female"]).nullable(),
              interests: z.array(z.string().max(60)).max(20),
              dietary_preference: z.string().max(40).nullable(),
              onboarded: z.boolean(),
            })
            .optional(),
          consents: z.object({
            sensitive_storage: z.boolean(),
            external_ai: z.boolean(),
          }),
        })
      : success;
  if (path === "privacy") return success;
  if (path === "conversations")
    return method === "DELETE"
      ? success
      : new URLSearchParams(query).has("id")
        ? z.array(messageSchema)
        : z.array(conversationSchema);
  return null;
}
