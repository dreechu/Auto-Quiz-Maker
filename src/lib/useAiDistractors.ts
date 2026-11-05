"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";

type AiChoiceCard = {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  difficulty?: string;
  format?: string;
};

type ChoiceResult = { key: string; choices: string[] };
type ChoiceRequestState = {
  key: string;
  loading: boolean;
  error?: string;
};

export function useAiDistractors(
  card: AiChoiceCard | undefined,
  existingAnswers: string[],
  enabled: boolean,
  user: User | null,
) {
  const [result, setResult] = useState<ChoiceResult | null>(null);
  const [requestState, setRequestState] = useState<ChoiceRequestState | null>(null);
  const [retryNumber, setRetryNumber] = useState(0);
  const attemptedKeys = useRef(new Set<string>());

  const missingCount = card ? Math.max(0, 3 - existingAnswers.length) : 0;
  const requestKey = card && missingCount > 0
    ? JSON.stringify([
        card.id,
        card.question,
        card.answer,
        card.hint ?? "",
        card.difficulty ?? "",
        card.format ?? "",
        [...existingAnswers].sort(),
      ])
    : "";

  useEffect(() => {
    if (!enabled || !card || !requestKey || !missingCount) return;
    if (result?.key === requestKey || attemptedKeys.current.has(requestKey)) return;
    if (!user) return;

    let active = true;
    attemptedKeys.current.add(requestKey);

    void (async () => {
      try {
        const idToken = await user.getIdToken();
        if (!active) return;
        setRequestState({ key: requestKey, loading: true });
        const requestBody = JSON.stringify({
          question: card.question,
          answer: card.answer,
          hint: card.hint ?? "",
          difficulty: card.difficulty ?? "",
          format: card.format ?? "",
          count: missingCount,
          existingAnswers,
        });
        const sendRequest = (token: string) =>
          fetch("/api/multiple-choice/choices", {
            method: "POST",
            headers: {
              Authorization: ["Bearer", token].join(" "),
              "Content-Type": "application/json",
            },
            body: requestBody,
          });
        let response = await sendRequest(idToken);
        if (response.status === 401) {
          const refreshedToken = await user.getIdToken(true);
          if (!active) return;
          response = await sendRequest(refreshedToken);
        }
        const payload = (await response.json()) as {
          choices?: unknown;
          error?: string;
        };
        if (response.status === 401) {
          throw new Error("Sign in again to generate additional answer choices.");
        }
        if (!response.ok || !Array.isArray(payload.choices)) {
          throw new Error(payload.error || "Additional answer choices couldn’t be generated.");
        }
        const choices = payload.choices.filter(
          (choice): choice is string => typeof choice === "string" && Boolean(choice.trim()),
        );
        if (choices.length !== missingCount) {
          throw new Error("The AI returned an incomplete set of answer choices. Please try again.");
        }
        if (!active) return;
        setResult({ key: requestKey, choices });
        setRequestState(null);
      } catch (error) {
        if (!active) return;
        setRequestState({
          key: requestKey,
          loading: false,
          error: error instanceof Error
            ? error.message
            : "Additional answer choices couldn’t be generated.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [
    card,
    enabled,
    existingAnswers,
    missingCount,
    requestKey,
    result,
    retryNumber,
    user,
  ]);

  const retry = useCallback(() => {
    if (!requestKey) return;
    attemptedKeys.current.delete(requestKey);
    setRequestState(null);
    setRetryNumber((value) => value + 1);
  }, [requestKey]);

  return {
    distractors: result?.key === requestKey ? result.choices : [],
    isGenerating: requestState?.key === requestKey && requestState.loading,
    error: requestState?.key === requestKey
      ? requestState.error
      : enabled && requestKey && !user
        ? "Sign in to generate additional answer choices."
        : undefined,
    retry,
  };
}
