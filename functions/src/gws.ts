import { execFileSync } from 'child_process'
import * as path from 'path'

// Resolve the gws binary from the npm package
function getGwsBinary(): string {
  try {
    // @googleworkspace/cli installs a binary — find it
    const pkgDir = path.dirname(require.resolve('@googleworkspace/cli/package.json'))
    // The binary is at the package's bin path
    const pkg = require('@googleworkspace/cli/package.json')
    const binName = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.gws || 'gws'
    return path.resolve(pkgDir, binName)
  } catch {
    // Fallback: assume gws is on PATH
    return 'gws'
  }
}

const GWS_BIN = getGwsBinary()

interface GwsOptions {
  token: string         // OAuth access token for the user
  projectId?: string    // GCP project ID for quota
  timeout?: number      // ms, default 30s
}

/**
 * Run a gws CLI command and return parsed JSON output.
 *
 * Examples:
 *   gws('gmail', 'users', 'messages', 'list', { token }, { userId: 'me', q: 'is:unread', maxResults: 5 })
 *   gws('calendar', 'events', 'list', { token }, { calendarId: 'primary', maxResults: 10 })
 *   gws('driveactivity', 'activity', 'query', { token }, {}, { pageSize: 10 })
 */
export function gws(
  service: string,
  ...parts: string[]
): GwsCommand {
  return new GwsCommand(service, parts)
}

export class GwsCommand {
  private service: string
  private parts: string[]

  constructor(service: string, parts: string[]) {
    this.service = service
    this.parts = parts
  }

  exec(opts: GwsOptions, params?: Record<string, any>, body?: Record<string, any>): any {
    const args = [this.service, ...this.parts]

    if (params && Object.keys(params).length > 0) {
      args.push('--params', JSON.stringify(params))
    }

    if (body && Object.keys(body).length > 0) {
      args.push('--json', JSON.stringify(body))
    }

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      GOOGLE_WORKSPACE_CLI_TOKEN: opts.token,
    }

    if (opts.projectId) {
      env.GOOGLE_WORKSPACE_PROJECT_ID = opts.projectId
    }

    try {
      const stdout = execFileSync(GWS_BIN, args, {
        env,
        timeout: opts.timeout || 30_000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      return JSON.parse(stdout)
    } catch (err: any) {
      console.error(`gws ${this.service} ${this.parts.join(' ')} failed:`, err.message)
      if (err.stdout) console.error('stdout:', err.stdout.toString().substring(0, 500))
      if (err.stderr) console.error('stderr:', err.stderr.toString().substring(0, 500))
      throw new Error(`gws command failed: ${err.message}`)
    }
  }
}

// Convenience functions for common operations

export function listRecentEmails(token: string, maxResults = 5): any {
  return gws('gmail', 'users', 'messages', 'list').exec(
    { token },
    { userId: 'me', q: 'is:unread', maxResults },
  )
}

export function getEmailMetadata(token: string, messageId: string): any {
  return gws('gmail', 'users', 'messages', 'get').exec(
    { token },
    { userId: 'me', id: messageId, format: 'metadata', metadataHeaders: 'From,Subject' },
  )
}

export function listUpcomingEvents(token: string, maxResults = 10): any {
  const now = new Date().toISOString()
  return gws('calendar', 'events', 'list').exec(
    { token },
    {
      calendarId: 'primary',
      maxResults,
      timeMin: now,
      singleEvents: true,
      orderBy: 'startTime',
    },
  )
}

export function queryDriveActivity(token: string, pageSize = 10): any {
  return gws('driveactivity', 'activity', 'query').exec(
    { token },
    {},
    { pageSize },
  )
}
