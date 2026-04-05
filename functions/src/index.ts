import * as admin from 'firebase-admin'

admin.initializeApp()

export { onGmailPush } from './gmail-webhook'
export { onCalendarEvent } from './calendar-webhook'
export { pollDriveActivity } from './drive-poller'
export { cleanupOldQuests } from './data-cleanup'
export { storeUserToken } from './store-token'
export { completeQuest } from './complete-quest'
