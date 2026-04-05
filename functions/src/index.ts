import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

export { onGmailPush } from './gmail-webhook'
export { onCalendarEvent } from './calendar-webhook'
export { pollDriveActivity } from './drive-poller'
export { cleanupOldQuests } from './data-cleanup'
