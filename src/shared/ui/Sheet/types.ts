import { ReactNode } from 'react';
import { SheetHeight } from './constants';

/**
 * Props for the StandardBottomSheet component
 */
export interface StandardBottomSheetProps {
  /**
   * Whether the sheet is visible
   */
  visible: boolean;

  /**
   * Callback when the sheet is closed (via gesture, backdrop tap, or programmatic close)
   */
  onClose: () => void;

  /**
   * Sheet height variant
   * @default 'form'
   *
   * - 'action': 35% - Quick action sheets with 2-3 options
   * - 'form': 65% - Forms, selectors, moderate content
   * - 'full': 90% - Complex content, long forms, scrollable lists
   * - 'auto': Dynamic - Fits content height
   */
  height?: SheetHeight | 'auto';

  /**
   * Custom snap points (overrides height variant)
   * Use this for multi-snap sheets
   * @example ['25%', '50%', '90%']
   */
  snapPoints?: string[];

  /**
   * Initial snap point index when using custom snapPoints
   * @default 0
   */
  initialSnapIndex?: number;

  /**
   * Whether the sheet can be closed by swiping down
   * @default true
   */
  enableSwipeClose?: boolean;

  /**
   * Whether the sheet content is scrollable
   * Use this for long content that needs scrolling
   * @default false
   */
  scrollable?: boolean;

  /**
   * Optional title displayed in the sheet header
   */
  title?: string;

  /**
   * Optional custom title component (overrides title string)
   */
  titleComponent?: ReactNode;

  /**
   * Whether to show a close button in the header
   * Only shown when title is provided
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Sheet content
   */
  children: ReactNode;

  /**
   * Test ID for testing
   */
  testID?: string;

  /**
   * Ref for the internal scroll view (only used when scrollable is true)
   */
  scrollRef?: React.RefObject<any>;

  /**
   * Optional footer component that stays sticky at the bottom
   * Useful for primary actions (e.g., Save, Submit) that should always be visible
   */
  footerComponent?: ReactNode;
  /**
   * Manually disable content panning gesture (useful for custom scrollables like FlatList)
   */
  disableContentPanning?: boolean;

  /**
   * Render function for custom scrollable content (BottomSheetFlatList, BottomSheetFlashList, etc.)
   * When provided, this renders directly inside the BottomSheet with proper header spacing,
   * bypassing the ContentWrapper to avoid gesture conflicts.
   * Use this for FlatLists/FlashLists that need proper scroll gesture handling.
   */
  renderScrollContent?: () => ReactNode;

  /**
   * Whether the sheet has unsaved changes.
   * If true, attempting to close the sheet (via backdrop press, close button, or swipe if enabled)
   * will trigger a confirmation alert.
   * @default false
   */
  hasUnsavedChanges?: boolean;

  /**
   * Custom message to display in the unsaved changes alert
   * @default "Discard Changes? You have unsaved changes. Are you sure you want to discard them?"
   */
  confirmCloseMessage?: string;
  /**
   * Custom portal host name to render the sheet into.
   * Useful when rendering sheets inside native Modals.
   */
  portalHost?: string;
}
