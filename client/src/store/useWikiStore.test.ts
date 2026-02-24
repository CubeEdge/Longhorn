// @ts-nocheck
import { strict as assert } from 'node:assert';

// Mock window and localStorage for Node environment
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem(key: string) {
            return store[key] || null;
        },
        setItem(key: string, value: string) {
            store[key] = value.toString();
        },
        removeItem(key: string) {
            delete store[key];
        },
        clear() {
            store = {};
        }
    };
})();

// Assign to global
Object.defineProperty(global, 'localStorage', {
    value: localStorageMock
});
Object.defineProperty(global, 'window', {
    value: { localStorage: localStorageMock }
});

async function runTests() {
    console.log('[Test] Starting useWikiStore tests...');

    // Import dynamically so the localStorage mock is available during module evaluation
    const { useWikiStore } = await import('./useWikiStore');

    // Reset store to baseline
    useWikiStore.setState({
        activeSearchQuery: null,
        searchQuery: '',
        pendingSearchQuery: '',
        isSearchMode: false,
        showSearchResults: false,
        selectedProductLine: 'A'
    });

    // Test 1: Initial state validation
    let state = useWikiStore.getState();
    assert.equal(state.selectedProductLine, 'A', 'Initial product line should be A');
    assert.equal(state.isSearchMode, false, 'Should not be in search mode initially');
    assert.equal(state.searchQuery, '', 'Search query should be empty');
    console.log('✅ Test 1 Passed: Initial state is correct');

    // Test 2: Toggle search mode and query
    useWikiStore.getState().setIsSearchMode(true);
    useWikiStore.getState().setSearchQuery('Kinefinity WIKI');
    state = useWikiStore.getState();
    assert.equal(state.isSearchMode, true, 'Search mode should be active');
    assert.equal(state.searchQuery, 'Kinefinity WIKI', 'Search query should update correctly');
    console.log('✅ Test 2 Passed: Toggle search mode and update query');

    // Test 3: Tab Switching
    useWikiStore.getState().setSelectedProductLine('B');
    useWikiStore.getState().setIsSearchMode(false);
    state = useWikiStore.getState();
    assert.equal(state.selectedProductLine, 'B', 'Product line should switch to B');
    assert.equal(state.isSearchMode, false, 'Search mode should toggle off');
    console.log('✅ Test 3 Passed: Selecting product lines');

    console.log('\\n🎉 All useWikiStore tests passed successfully!');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
