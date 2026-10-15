import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const MODEL = "gpt-5.4-nano";
const MAX_INPUT_LENGTH = 500;
const MAX_MEMBERS = 25;

const quickAddSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: ["string", "null"] },
    familyMemberId: { type: ["string", "null"] },
    familyMemberName: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "Local date in YYYY-MM-DD format." },
    startTime: { type: ["string", "null"], description: "Local 24-hour time in HH:mm format." },
    endTime: { type: ["string", "null"], description: "Local 24-hour time in HH:mm format." },
    allDay: { type: "boolean" },
    frequency: {
      type: "string",
      enum: ["none", "daily", "weekly", "monthly", "yearly"],
    },
    interval: { type: "integer", minimum: 1, maximum: 100 },
    weekdays: {
      type: "array",
      items: { type: "string", enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] },
    },
    recurrenceEndDate: { type: ["string", "null"], description: "Date in YYYY-MM-DD format." },
    location: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          message: { type: "string" },
        },
        required: ["field", "message"],
      },
    },
  },
  required: [
    "title",
    "familyMemberId",
    "familyMemberName",
    "date",
    "startTime",
    "endTime",
    "allDay",
    "frequency",
    "interval",
    "weekdays",
    "recurrenceEndDate",
    "location",
    "notes",
    "ambiguities",
  ],
};

function validateRequest(data) {
  const sentence = typeof data?.sentence === "string" ? data.sentence.trim() : "";
  if (!sentence || sentence.length > MAX_INPUT_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Event description must contain 1 to ${MAX_INPUT_LENGTH} characters.`,
    );
  }

  const members = Array.isArray(data?.members)
    ? data.members
        .slice(0, MAX_MEMBERS)
        .filter((member) => member && typeof member.name === "string")
        .map((member) => ({
          id: String(member.id || ""),
          name: member.name.trim().slice(0, 100),
        }))
        .filter((member) => member.name)
    : [];

  const now = new Date(data?.now);
  if (Number.isNaN(now.getTime())) {
    throw new HttpsError("invalid-argument", "A valid current date is required.");
  }

  return {
    sentence,
    members,
    now: now.toISOString(),
    timeZone: typeof data?.timeZone === "string" ? data.timeZone.slice(0, 100) : "UTC",
  };
}

function buildInstructions() {
  return [
    "Extract one family calendar event from the user's sentence.",
    "Never create the event and never invent missing details.",
    "Use only a supplied family member. Otherwise return null for both member fields.",
    "Resolve relative dates using the supplied current timestamp and IANA time zone.",
    "If a date is known but no exact clock time is supplied, set allDay to true and leave both times null.",
    "Words such as morning, afternoon, evening, later, or after school are not exact clock times.",
    "If a numeric time omits AM or PM and is ambiguous, leave it null and add an ambiguity.",
    "For a timed event with no stated end time, leave endTime null.",
    "Use frequency none when the sentence does not repeat.",
    "Use two-letter weekday codes and ISO date/time strings exactly as required by the schema.",
    "Keep the title concise and remove framing phrases such as has to, needs to, will, add, or schedule.",
  ].join(" ");
}

export const parseQuickAddWithAi = onCall(
  {
    secrets: [openAiApiKey],
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before using AI Quick Add.");
    }

    const input = validateRequest(request.data);

    try {
      const openai = new OpenAI({ apiKey: openAiApiKey.value() });
      const response = await openai.responses.create({
        model: MODEL,
        instructions: buildInstructions(),
        input: JSON.stringify(input),
        text: {
          format: {
            type: "json_schema",
            name: "family_calendar_quick_add",
            strict: true,
            schema: quickAddSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new Error("The model returned no structured output.");
      }

      return {
        result: JSON.parse(response.output_text),
        model: MODEL,
      };
    } catch (error) {
      logger.error("AI Quick Add parsing failed", {
        uid: request.auth.uid,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(
        "internal",
        "AI Quick Add is temporarily unavailable. You can still complete the event manually.",
      );
    }
  },
);
