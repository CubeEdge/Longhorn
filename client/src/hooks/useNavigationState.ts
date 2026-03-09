/**
 * Navigation State Management Hook
 * 
 * Manages module switching and path memory for Service/Files modules.
 * Persists state to localStorage for seamless user experience.
 */

import { useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type ModuleType = 'service' | 'files';

interface SavedPaths {
  lastServicePath: string;
  lastFilesPath: string;
}

const NAV_STATE_KEY = 'longhorn_nav_state';
const NAV_STATE_VERSION_KEY = 'longhorn_nav_state_version';
const CURRENT_NAV_VERSION = '2'; // Bump this when making breaking changes to nav state

const DEFAULT_PATHS: SavedPaths = {
  lastServicePath: '/service/inquiry-tickets', // Guaranteed entry point
  lastFilesPath: '/files/personal',
};

// Service module routes
const SERVICE_ROUTES = [
  '/service',
  // Note: '/settings' is intentionally NOT included here - it's a system page, not part of service module
  '/admin/settings',
  '/admin/intelligence',
  '/admin/health',
  '/service/rma-tickets',
  '/service/inquiry-tickets',
  '/service/dealer-repairs',
  '/service/knowledge',
  '/service-records',
  '/context',
  '/tech-hub',
];

// Paths that should NOT be saved as "last visited" (they're utility/settings pages)
const EXCLUDED_FROM_SAVE = ['/settings'];

// Files module routes - must be specific to avoid conflicts with Service admin routes
const FILES_ROUTES = [
  '/files',
  '/files/personal',
  '/files/dept',
  '/files/root',
  '/files/starred',
  '/files/shares',
  '/files/recycle',
  '/files/search',
  '/files/recent',
  '/dashboard', // Files overview
  '/personal',
  '/dept',
  '/root',
  '/members',
  '/starred',
  '/shares',
  '/recycle',
  '/search',
  '/recent',
];

/**
 * Determines which module a path belongs to
 */
export function getModuleFromPath(path: string): ModuleType {
  // Check service routes first
  for (const route of SERVICE_ROUTES) {
    if (path.startsWith(route)) {
      return 'service';
    }
  }

  // Check files routes
  for (const route of FILES_ROUTES) {
    if (path.startsWith(route)) {
      return 'files';
    }
  }

  // Default to service
  return 'service';
}

/**
 * Load saved paths from localStorage
 */
function loadSavedPaths(): SavedPaths {
  try {
    // Check version - if outdated, reset to defaults
    const savedVersion = localStorage.getItem(NAV_STATE_VERSION_KEY);
    if (savedVersion !== CURRENT_NAV_VERSION) {
      console.log(`[NavigationState] Version changed from ${savedVersion} to ${CURRENT_NAV_VERSION}, resetting nav state`);
      localStorage.setItem(NAV_STATE_VERSION_KEY, CURRENT_NAV_VERSION);
      localStorage.removeItem(NAV_STATE_KEY);
      return DEFAULT_PATHS;
    }

    const saved = localStorage.getItem(NAV_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const paths = { ...DEFAULT_PATHS, ...parsed };

      // Critical Validation: Ensure saved paths actually belong to the module they claim
      // Also reset if the saved path is an excluded path (like /settings)
      const serviceExcluded = EXCLUDED_FROM_SAVE.some(p => paths.lastServicePath.startsWith(p));
      if (getModuleFromPath(paths.lastServicePath) !== 'service' || serviceExcluded) {
        console.log('[NavigationState] Invalid/excluded service path, resetting to default');
        paths.lastServicePath = DEFAULT_PATHS.lastServicePath;
      }
      
      const filesExcluded = EXCLUDED_FROM_SAVE.some(p => paths.lastFilesPath.startsWith(p));
      if (getModuleFromPath(paths.lastFilesPath) !== 'files' || filesExcluded) {
        console.log('[NavigationState] Invalid/excluded files path, resetting to default');
        paths.lastFilesPath = DEFAULT_PATHS.lastFilesPath;
      }

      return paths;
    }
  } catch (e) {
    console.warn('[NavigationState] Failed to load saved state:', e);
  }
  return DEFAULT_PATHS;
}

/**
 * Save paths to localStorage
 */
function savePaths(paths: SavedPaths): void {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(paths));
    localStorage.setItem(NAV_STATE_VERSION_KEY, CURRENT_NAV_VERSION);
  } catch (e) {
    console.warn('[NavigationState] Failed to save state:', e);
  }
}

/**
 * Hook for managing navigation state across modules
 */
export function useNavigationState() {
  const location = useLocation();
  const navigate = useNavigate();

  // Store saved paths in state, initialized from localStorage
  const [savedPaths, setSavedPaths] = useState<SavedPaths>(loadSavedPaths);

  // Derive current module from URL (computed, not stored)
  const currentModule = useMemo(() => {
    return getModuleFromPath(location.pathname);
  }, [location.pathname]);

  // Update path when navigating - called explicitly, not in effect
  const updateCurrentPath = useCallback(() => {
    const currentPath = location.pathname;
    
    // Don't save excluded paths (like /settings) - they shouldn't override module entry points
    const shouldExclude = EXCLUDED_FROM_SAVE.some(p => currentPath.startsWith(p));
    if (shouldExclude) {
      return;
    }
    
    const module = getModuleFromPath(currentPath);

    setSavedPaths(prev => {
      let newPaths = prev;

      if (module === 'service' && currentPath !== prev.lastServicePath) {
        newPaths = { ...prev, lastServicePath: currentPath };
      } else if (module === 'files' && currentPath !== prev.lastFilesPath) {
        newPaths = { ...prev, lastFilesPath: currentPath };
      }

      if (newPaths !== prev) {
        savePaths(newPaths);
      }

      return newPaths;
    });
  }, [location.pathname]);

  /**
   * Switch to a different module
   * Navigates to the last visited path in that module
   */
  const switchModule = useCallback((targetModule: ModuleType) => {
    console.log(`[NavigationState] switchModule called for: ${targetModule}`);
    
    // First save current path (if not excluded)
    updateCurrentPath();

    // Read fresh from localStorage to avoid stale closure issues
    const freshPaths = loadSavedPaths();
    console.log(`[NavigationState] Loaded paths from localStorage:`, freshPaths);
    
    // Always navigate when explicitly switching modules
    const targetPath = targetModule === 'service'
      ? freshPaths.lastServicePath
      : freshPaths.lastFilesPath;

    console.log(`[NavigationState] Switching to ${targetModule}, navigating to: ${targetPath}`);
    navigate(targetPath);
  }, [navigate, updateCurrentPath]);

  /**
   * Get the default path for initial navigation
   */
  const getDefaultPath = useCallback((canAccessFiles: boolean): string => {
    if (currentModule === 'files' && canAccessFiles) {
      return savedPaths.lastFilesPath;
    }
    return savedPaths.lastServicePath;
  }, [currentModule, savedPaths]);

  return {
    currentModule,
    lastServicePath: savedPaths.lastServicePath,
    lastFilesPath: savedPaths.lastFilesPath,
    switchModule,
    getDefaultPath,
  };
}

/**
 * Check if user can access Files module based on role
 * Only internal employees (Admin, Lead, Member) can access Files
 * Dealers cannot access Files
 */
export function canAccessFilesModule(role: string): boolean {
  return ['Admin', 'Lead', 'Member'].includes(role);
}
