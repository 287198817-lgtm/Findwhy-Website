type HostingEnvironment = {
  PAYLOAD_SERVER_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
  VERCEL_URL?: string
}

const FRONTEND_ORIGIN = 'https://findwhy.art'
const DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

const toOrigin = (value: string | undefined, defaultProtocol = false): string | null => {
  const candidate = value?.trim()
  if (!candidate) return null

  try {
    const url = new URL(defaultProtocol && !candidate.includes('://') ? `https://${candidate}` : candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/**
 * Keep Payload's existing platform-derived behavior unless self-hosting is
 * explicitly enabled with PAYLOAD_SERVER_URL.
 */
export const resolveSelfHostConfig = (environment: HostingEnvironment = {
  PAYLOAD_SERVER_URL: process.env.PAYLOAD_SERVER_URL,
  VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
}) => {
  const serverURL = toOrigin(environment.PAYLOAD_SERVER_URL)
  if (!serverURL) return {}

  const origins = new Set<string>([serverURL, FRONTEND_ORIGIN, ...DEVELOPMENT_ORIGINS])
  for (const candidate of [
    environment.VERCEL_URL,
    environment.VERCEL_BRANCH_URL,
    environment.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const origin = toOrigin(candidate, true)
    if (origin) origins.add(origin)
  }

  const allowedOrigins = [...origins]
  return {
    cors: allowedOrigins,
    csrf: allowedOrigins,
    serverURL,
  }
}
