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

const DEFAULT_PATHS: SavedPaths = {
  lastServicePath: '/service/inquiry-tickets', // Guaranteed entry point
  lastFilesPath: '/files/personal',
};

// Service module routes
const SERVICE_ROUTES = [
  '/service',
  '/admin/settings',
  '/admin/intelligence',
  '/admin/health',
  '/service/rma-tickets',
  '/service/inquiry-tickets',
  '/service/dealer-repairs',
  '/service/knowledge',
  '/service-records',
  '/context',
];

// Files module routes
const FILES_ROUTES = [
  '/files',
  '/admin', // Catch-all for files admin (dashboard, users, depts)
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
    const saved = localStorage.getItem(NAV_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const paths = { ...DEFAULT_PATHS, ...parsed };

      // Critical Validation: Ensure saved paths actually belong to the module they claim
      // This prevents "unresponsive icon" if a path like /dashboard was moved from service to files
      if (getModuleFromPath(paths.lastServicePath) !== 'service') {
        console.log('[NavigationState] Invalid service path, resetting to default');
        paths.lastServicePath = DEFAULT_PATHS.lastServicePath;
      }
      if (getModuleFromPath(paths.lastFilesPath) !== 'files') {
        console.log('[NavigationState] Invalid files path, resetting to default');
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
    // First save current path
    updateCurrentPath();

    if (targetModule === currentModule) return;

    const targetPath = targetModule === 'service'
      ? savedPaths.lastServicePath
      : savedPaths.lastFilesPath;

    navigate(targetPath);
  }, [currentModule, savedPaths, navigate, updateCurrentPath]);

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
