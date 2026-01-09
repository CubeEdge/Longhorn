import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Get version info at build time
const getVersionInfo = () => {
  try {
    // Get git commit hash (short)
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

    // Get version from root package.json
    const pkgPath = resolve(__dirname, '../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const version = pkg.version || '0.0.0'

    // Get build timestamp
    const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

    return {
      version,
      commitHash,
      buildTime,
      fullVersion: `${version} (${commitHash})`
    }
  } catch (e) {
    console.warn('Could not get version info:', e)
    return {
      version: '11.3.0',
      commitHash: 'unknown',
      buildTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
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
    __APP_BUILD_TIME__: JSON.stringify(versionInfo.buildTime),
    __APP_FULL_VERSION__: JSON.stringify(versionInfo.fullVersion)
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/preview': 'http://localhost:4000'
    }
  }
})
