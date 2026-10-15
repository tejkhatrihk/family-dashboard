import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "../../../shared/api/firebaseClient";
import { normalizeAiQuickAddResult } from "./quickAddAiResult";

export async function parseQuickAddWithAi(
  sentence,
  { members = [], now = new Date(), deterministicResult = null } = {},
) {
  if (!firebaseFunctions) {
    throw new Error("Firebase Functions is not configured.");
  }

  const callable = httpsCallable(firebaseFunctions, "parseQuickAddWithAi");
  const response = await callable({
    sentence,
    members: members.map(({ id, name }) => ({ id, name })),
    now: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return normalizeAiQuickAddResult(sentence, response.data.result, {
    members,
    deterministicResult,
  });
}
