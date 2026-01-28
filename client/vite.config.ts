import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Get version info at build time
const getVersionInfo = () => {
  const formatBeijingTime = (date: Date) => {
    // Force Beijing format regardless of build machine settings
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).replace(/\//g, '-');
  }

  try {
    // Get git commit hash (short)
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

    // Get git commit time
    const commitTimestamp = parseInt(execSync('git log -1 --format=%ct').toString().trim()) * 1000
    const commitTime = formatBeijingTime(new Date(commitTimestamp))

    // Get version from root package.json
    const pkgPath = resolve(__dirname, '../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const version = pkg.version || '0.0.0'

    // Get build timestamp in Beijing time
    const buildTime = formatBeijingTime(new Date())

    return {
      version,
      commitHash,
      commitTime,
      buildTime,
      fullVersion: `${version} (${commitHash})`
    }
  } catch (e) {
    console.warn('Could not get version info:', e)
    const now = formatBeijingTime(new Date())
    return {
      version: '11.3.0',
      commitHash: 'unknown',
      commitTime: now,
      buildTime: now,
      fullVersion: '11.3.0 (dev)'
    }
  }
}

const versionInfo = getVersionInfo()
console.log(`Building Longhorn ${versionInfo.fullVersion}`)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inject version info as global constants
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __APP_COMMIT__: JSON.stringify(versionInfo.commitHash),
    __APP_COMMIT_TIME__: JSON.stringify(versionInfo.commitTime),
    __APP_BUILD_TIME__: JSON.stringify(versionInfo.buildTime),
    __APP_FULL_VERSION__: JSON.stringify(versionInfo.fullVersion)
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://opware.kineraw.com',
        changeOrigin: true,
        secure: false
      },
      '/preview': {
        target: 'https://opware.kineraw.com',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
