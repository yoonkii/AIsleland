import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { generateQuest, makeIdempotencyKey } from './quest-generator'

const db = admin.firestore()

// Poll Drive Activity API every 5 minutes for Docs/Sheets/Slides changes
export const pollDriveActivity = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1' },
  async () => {
    // In production: iterate over all users with active sessions,
    // call Drive Activity API with their OAuth tokens, and create quests
    // for detected edits.
    //
    // For MVP, this is a placeholder. The full implementation will:
    // 1. Query users who were active in the last hour
    // 2. For each user, get their OAuth token from Secret Manager
    // 3. Call driveactivity.activity.query with the token
    // 4. Filter for doc/sheet/slide edit actions
    // 5. Generate quests for new activity (with idempotency)
    //
    // Example gws CLI usage in Cloud Functions:
    // const { execSync } = require('child_process')
    // const result = execSync('gws driveactivity query --format json', { env: { ...process.env, GWS_TOKEN: token } })

    console.log('Drive activity poll: placeholder (implement with gws CLI)')
  }
)
