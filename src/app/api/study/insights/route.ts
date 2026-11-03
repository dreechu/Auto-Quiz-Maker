import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";

type StudyDay = { reviews?: number; correct?: number };

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 365 * 86_400_000);
    const snapshot = await getAdminDatabase()
      .ref(`users/${identity.uid}/studyDays`)
      .orderByKey()
      .startAt(dateKey(cutoff))
      .get();
    const days = (snapshot.val() ?? {}) as Record<string, StudyDay>;
    const today = new Date();
    let streakDays = 0;
    const streakDate = new Date(`${dateKey(today)}T00:00:00.000Z`);
    const todayKey = dateKey(today);
    const yesterday = new Date(streakDate.getTime() - 86_400_000);
    if (!Number(days[todayKey]?.reviews) && !Number(days[dateKey(yesterday)]?.reviews)) {
      streakDays = 0;
    } else {
      if (!Number(days[todayKey]?.reviews)) streakDate.setTime(yesterday.getTime());
      while (Number(days[dateKey(streakDate)]?.reviews) > 0) {
        streakDays += 1;
        streakDate.setTime(streakDate.getTime() - 86_400_000);
      }
    }

    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getTime() - (6 - index) * 86_400_000);
      const dateString = dateKey(date);
      const day = days[dateString];
      return {
        date: dateString,
        reviews: Math.max(0, Number(day?.reviews) || 0),
        correct: Math.max(0, Number(day?.correct) || 0),
      };
    });
    const totalReviews = recentDays.reduce((sum, day) => sum + day.reviews, 0);
    const correctReviews = recentDays.reduce((sum, day) => sum + day.correct, 0);
    return Response.json({
      streakDays,
      totalReviews,
      accuracy: totalReviews ? Math.round((correctReviews / totalReviews) * 100) : 0,
      recentDays,
    });
  } catch (error) {
    console.error("Could not load study insights.", error);
    return Response.json({ error: "Study insights couldn’t be loaded. Please try again." }, { status: 500 });
  }
}
