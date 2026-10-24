export type Answers = Record<string, string>;
export type Question = {
  id: string;
  title: string;
  note: string;
  choices?: string[];
  kind?: "text" | "date" | "email";
  optional?: boolean;
  placeholder?: string;
};
export const core: Question[] = [
  {
    id: "name",
    title: "First, what should we call you?",
    note: "A little introduction. A more personal companion.",
    kind: "text",
    placeholder: "Your first name",
  },
  {
    id: "birthday",
    title: "When is your birthday?",
    note: "Your age helps put your information in context. This pilot is for adults 18 and over.",
    kind: "date",
  },
  {
    id: "purpose",
    title: "What brings you here?",
    note: "Start with what matters most. We’ll shape the next questions around it.",
    choices: [
      "Feel better on a trip",
      "Eat with more confidence",
      "Build healthier travel habits",
      "Just getting to know you",
    ],
  },
  {
    id: "journey",
    title: "Where are you in your journey?",
    note: "Your companion should meet you where you are.",
    choices: [
      "Planning a trip",
      "Travelling right now",
      "Recently returned",
      "No trip planned",
    ],
  },
  {
    id: "diet",
    title: "How do you usually eat?",
    note: "No perfect answers. Just your everyday preference.",
    choices: [
      "No particular preference",
      "Vegetarian",
      "Vegan",
      "Pescatarian",
      "Non-vegetarian",
    ],
  },
  {
    id: "allergies",
    title: "Any food allergies to keep in mind?",
    note: "Only share what you know. You can add specific details in the deeper profile.",
    choices: [
      "No known food allergies",
      "Yes, I have food allergies",
      "I’m not sure",
      "Prefer not to say",
    ],
  },
  {
    id: "pace",
    title: "What feels like your kind of travel?",
    note: "There’s a difference between a packed itinerary and a slow morning.",
    choices: [
      "Slow & unhurried",
      "A little of everything",
      "Always exploring",
      "It depends on the day",
    ],
  },
  {
    id: "style",
    title: "How should your companion respond?",
    note: "The same attention, in a style that feels right for you.",
    choices: [
      "Keep it short & practical",
      "Talk me through it",
      "Give me the details",
    ],
  },
  {
    id: "privacy",
    title: "You decide what stays with us.",
    note: "These choices are independent. You can continue with both turned off.",
  },
];
export function coreQuestions(a: Answers): Question[] {
  return core.map((q) => {
    if (q.id === "journey" && a.purpose === "Feel better on a trip")
      return {
        ...q,
        title: "Are you away from home right now?",
        note: "This helps us understand your situation. This setup does not assess symptoms or provide urgent care.",
      };
    if (q.id === "diet" && a.purpose === "Eat with more confidence")
      return { ...q, title: "Let’s start with the food you feel good eating." };
    if (q.id === "pace" && a.journey === "No trip planned")
      return { ...q, title: "When you do travel, what feels like you?" };
    if (q.id === "style" && a.name)
      return {
        ...q,
        title: `${a.name.trim().split(" ")[0]}, how should we talk?`,
      };
    return q;
  });
}
const choice = (
  id: string,
  title: string,
  choices: string[],
  note = "Optional. Share only what you’d like your companion to understand.",
): Question => ({ id, title, choices, note, optional: true });
export function deeperQuestions(a: Answers): Question[] {
  const questions: Question[] = [
    choice("frequency", "How often do you travel?", [
      "A few times a year",
      "Every few months",
      "Most months",
      "This is my first trip",
    ]),
    choice("company", "Who usually comes along?", [
      "I travel solo",
      "A partner",
      "Friends",
      "Family",
    ]),
    choice("length", "How long is your usual getaway?", [
      "A day or two",
      "Under a week",
      "One to two weeks",
      "A little longer",
    ]),
    choice("destinationType", "Where do you feel most yourself?", [
      "Mountains & forests",
      "By the sea",
      "A new city",
      "Somewhere quiet",
    ]),
    {
      id: "home",
      title: "Where do you call home?",
      note: "A city or region is enough. No precise address needed.",
      kind: "text",
      optional: true,
      placeholder: "City or region",
    },
    choice("climate", "What weather feels most comfortable?", [
      "Cool & crisp",
      "Warm & sunny",
      "Somewhere in between",
      "No preference",
    ]),
    choice("foodAdventure", "How adventurous are you with food?", [
      "Familiar favourites",
      "New things, slowly",
      "Always trying something new",
    ]),
    choice("spice", "How do you feel about spice?", [
      "Keep it mild",
      "A little heat",
      "Love it spicy",
      "It varies",
    ]),
    choice("mealPattern", "What does a typical eating day look like?", [
      "Three regular meals",
      "Small meals often",
      "It changes every day",
      "Prefer not to say",
    ]),
    choice("breakfast", "How do your mornings usually begin?", [
      "A proper breakfast",
      "Something light",
      "Usually later",
      "No regular pattern",
    ]),
    choice("water", "How easy is it to remember water?", [
      "Easy for me",
      "I sometimes forget",
      "A gentle reminder would help",
    ]),
    choice("caffeine", "Is caffeine part of your day?", [
      "Not usually",
      "One cup or so",
      "A few cups",
      "Prefer not to say",
    ]),
    choice("sleep", "How does sleep feel when you travel?", [
      "Usually restful",
      "A little disrupted",
      "Quite unpredictable",
      "Not sure yet",
    ]),
    choice("bedtime", "Are you more of a morning or evening person?", [
      "Early mornings",
      "Late evenings",
      "Somewhere in between",
    ]),
    choice("activity", "What movement do you enjoy?", [
      "Walking",
      "Hiking & outdoors",
      "Workouts",
      "Gentle movement",
      "No preference",
    ]),
    choice("walking", "How much walking feels comfortable?", [
      "Short walks",
      "A few kilometres",
      "Long days on foot",
      "It varies",
    ]),
    choice("routine", "How much routine do you like on a trip?", [
      "A familiar rhythm",
      "Some structure",
      "Take each day as it comes",
    ]),
    choice("reminders", "Would gentle check-ins be useful?", [
      "Yes, occasionally",
      "Only when I ask",
      "No reminders",
    ]),
    choice("language", "Which language feels most natural?", [
      "English",
      "Malayalam",
      "Hindi",
      "Another language",
    ]),
    choice("voice", "How would you like to talk?", [
      "Mostly text",
      "Mostly voice",
      "A little of both",
    ]),
    choice("detail", "When something is unclear, what helps?", [
      "A simple next step",
      "A short explanation",
      "Sources I can explore",
    ]),
    choice("tracking", "What would you like to keep track of?", [
      "Meals",
      "Sleep & energy",
      "How I’m feeling",
      "A bit of everything",
      "Nothing for now",
    ]),
    choice("logging", "How would you prefer to add updates?", [
      "Quick taps",
      "A short note",
      "Speak naturally",
    ]),
    choice("budget", "How do you usually choose where to eat?", [
      "Keep it affordable",
      "Balance comfort & cost",
      "Experience comes first",
      "It depends",
    ]),
    choice("support", "What makes a companion feel helpful?", [
      "Remembering my preferences",
      "Helping me stay organised",
      "Making information clearer",
    ]),
    {
      id: "anything",
      title: "Anything else that makes you, you?",
      note: "A preference, a worry, or something we haven’t asked. You can leave this blank.",
      kind: "text",
      optional: true,
      placeholder: "In your own words…",
    },
  ];
  if (a.allergies === "Yes, I have food allergies")
    questions.splice(7, 0, {
      id: "allergyDetails",
      title: "Which food allergies have you been told you have?",
      note: "Use your own words. This is a reported detail, not a diagnosis.",
      kind: "text",
      optional: true,
      placeholder: "For example, peanuts",
    });
  if (a.journey !== "No trip planned")
    questions.splice(2, 0, {
      id: "destination",
      title:
        a.journey === "Travelling right now"
          ? "Where has this journey taken you?"
          : "Where is your next chapter?",
      note: "A city or country is enough. You can skip this.",
      kind: "text",
      optional: true,
      placeholder: "Your destination",
    });
  if (a.purpose === "Build healthier travel habits")
    questions.splice(
      12,
      0,
      choice("habit", "Which habit would you like to start with?", [
        "A steadier sleep routine",
        "Remembering water",
        "Regular meals",
        "More daily movement",
      ]),
    );
  if (a.company === "Family")
    questions.splice(
      3,
      0,
      choice("family", "What helps most on a family trip?", [
        "A calmer pace",
        "Familiar food options",
        "Room for everyone’s routine",
      ]),
    );
  if (a.reminders === "Yes, occasionally")
    questions.splice(
      questions.findIndex((q) => q.id === "language"),
      0,
      choice("checkinTime", "When would a check-in feel welcome?", [
        "In the morning",
        "In the evening",
        "Only during a trip",
      ]),
    );
  return questions;
}
export function isAdult(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`),
    now = new Date();
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return false;
  const age =
    now.getFullYear() -
    d.getUTCFullYear() -
    (now.getMonth() < d.getUTCMonth() ||
    (now.getMonth() === d.getUTCMonth() && now.getDate() < d.getUTCDate())
      ? 1
      : 0);
  return age >= 18 && age <= 130;
}
