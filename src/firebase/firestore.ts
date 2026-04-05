import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, onSnapshot, addDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type { IslandDoc, QuestDoc, QuestEventDoc, UserDoc } from './types'

// --- User ---

export async function getOrCreateUser(uid: string, email: string, displayName: string): Promise<UserDoc> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { lastActive: Date.now() })
    return snap.data() as UserDoc
  }
  const userData: UserDoc = {
    email,
    displayName,
    createdAt: Date.now(),
    lastActive: Date.now(),
  }
  await setDoc(ref, userData)
  return userData
}

// --- Island ---

export async function getOrCreateIsland(uid: string): Promise<IslandDoc> {
  const ref = doc(db, 'islands', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as IslandDoc

  const initial: IslandDoc = {
    level: 1,
    xp: 0,
    xpToNextLevel: 60,
    season: getCurrentSeason(),
    unlockedAssetTypes: ['flower-1', 'flower-2', 'flower-3'],
    characters: [],
    streakCount: 0,
    lastQuestCompletedAt: null,
  }
  await setDoc(ref, initial)
  return initial
}

export function subscribeToIsland(uid: string, callback: (island: IslandDoc) => void): Unsubscribe {
  return onSnapshot(doc(db, 'islands', uid), (snap) => {
    if (snap.exists()) callback(snap.data() as IslandDoc)
  })
}

// --- Quests ---

export interface QuestDocWithId extends QuestDoc {
  id: string
}

export function subscribeToQuests(uid: string, callback: (quests: QuestDocWithId[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'quests'),
    where('userId', '==', uid),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as QuestDocWithId)))
  })
}

// --- Quest Events (for growth animations) ---

export function subscribeToQuestEvents(
  uid: string,
  since: number,
  callback: (events: QuestEventDoc[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'quest_events'),
    where('userId', '==', uid),
    where('timestamp', '>', since),
    orderBy('timestamp', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as QuestEventDoc))
  })
}

// --- Self-report quest completion ---

export async function selfReportComplete(questId: string, uid: string): Promise<void> {
  // Write a quest_event that the Cloud Function will validate
  await addDoc(collection(db, 'quest_events'), {
    userId: uid,
    questId,
    type: 'completed',
    timestamp: Date.now(),
  } satisfies QuestEventDoc)
}

function getCurrentSeason(): IslandDoc['season'] {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}
