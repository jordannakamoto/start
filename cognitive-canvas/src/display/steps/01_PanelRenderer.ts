// Step 1: Panel Layout Rendering
// Establishes the basic layout structure

import { registerDrawStep, RenderContext } from '../FirstDrawCoordinator';
import { displayState } from '../DisplayState';

// Register the panel rendering step
registerDrawStep('Panel Layout', 1, async (context: RenderContext) => {
  const { state, isFirstDraw } = context;
  
  // Skip verbose logging during first draw for speed
  if (!isFirstDraw) {
    console.log('🔲 Rendering panel layout:', {
      main: state.panels.main,
      sidebar: state.panels.sidebar
    });
  }

  // Store panel layout in global cache for React components
  (window as any).panelLayout = {
    main: {
      width: state.panels.main.width,
      visible: state.panels.main.visible
    },
    sidebar: {
      width: state.panels.sidebar.width,
      visible: state.panels.sidebar.visible
    }
  };

  // Emit event for React components to pick up
  window.dispatchEvent(new CustomEvent('panels-rendered', {
    detail: { panels: state.panels }
  }));
});

// Panel state management utilities
export class PanelRenderer {
  static updatePanelWidth(panelId: 'main' | 'sidebar', width: number): void {
    console.log(`🔲 Updating ${panelId} panel width:`, width);
    displayState.updatePanel(panelId, { width });
  }

  static togglePanelVisibility(panelId: 'main' | 'sidebar'): void {
    const current = displayState.getState().panels[panelId];
    console.log(`🔲 Toggling ${panelId} panel visibility:`, !current.visible);
    displayState.updatePanel(panelId, { visible: !current.visible });
  }

  static getPanelLayout() {
    return displayState.getState().panels;
  }

  static getVisiblePanels(): Array<'main' | 'sidebar'> {
    const panels = displayState.getState().panels;
    return (Object.keys(panels) as Array<'main' | 'sidebar'>)
      .filter(panelId => panels[panelId].visible);
  }
}