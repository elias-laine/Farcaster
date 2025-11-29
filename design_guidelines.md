# Farcaster Mini App Design Guidelines

## Design Approach: Utility-First Web3 System

**Selected Framework**: Material Design 3 principles adapted for Web3, with influence from Linear's clean data presentation and Notion's task management clarity.

**Rationale**: This is a utility-focused application requiring clear task progression, blockchain interaction feedback, and data visualization. Users need immediate understanding of their status, not visual flair.

---

## Typography System

**Font Stack**: Inter (primary) + JetBrains Mono (addresses/hashes)
- **Headings**: 
  - H1: text-3xl font-bold (Main app title, lottery status)
  - H2: text-2xl font-semibold (Section headers: "Complete Tasks", "Mint SBT", "Admin Panel")
  - H3: text-xl font-medium (Card titles, stat labels)
- **Body**: text-base font-normal (Descriptions, instructions)
- **Small**: text-sm (Helper text, timestamps, wallet addresses)
- **Mono**: font-mono text-sm (Contract addresses, transaction hashes, countdown timers)

---

## Layout System

**Tailwind Spacing Primitives**: 4, 6, 8, 12 units
- `p-4, p-6`: Card padding, small containers
- `p-8`: Large card padding, section padding
- `gap-4, gap-6`: Grid/flex gaps
- `space-y-6, space-y-8`: Vertical section spacing
- `h-12`: Button heights, input heights
- `h-8`: Icon containers, small buttons

**Container Strategy**:
- Max width: `max-w-4xl mx-auto` (main app container)
- Admin panel: `max-w-6xl mx-auto` (needs more width for data tables)
- Cards: Full width within container, consistent `rounded-lg` borders

---

## Component Library

### 1. Task Verification Cards (Core UX)
Three distinct cards in vertical stack (`space-y-4`):
```
Task Card Structure:
- Icon + Task Name (flex items-center gap-4)
- Status Badge (Pending/Verified with checkmark icon)
- Action Button (if not verified)
- Verification timestamp (text-sm, when completed)

Layout: Full-width cards, p-6, border, rounded-lg
State indicators: Disabled state for locked tasks, success state with checkmark
```

### 2. Progress Indicator
Linear progress bar showing 0/3 → 3/3 tasks completed
- Height: h-2
- Container: mb-8 (top of task section)
- Includes text label: "1 of 3 tasks completed"

### 3. Mint SBT Section
Prominent centered card appearing ONLY when all tasks verified:
- Large mint button (h-12, px-8, rounded-lg)
- Transaction status display (pending/success/error)
- Wallet connection badge (top-right of card)
- Post-mint confirmation with transaction hash link

### 4. Lottery Stats Dashboard
Grid layout: `grid grid-cols-2 md:grid-cols-4 gap-4`
Four stat cards showing:
- Total participants (numeric display, text-4xl font-bold)
- Current tier (badge with threshold info)
- Prize pool amount (prominent $ display)
- Time remaining (countdown, font-mono)

### 5. Admin Panel (Separate Route)
Table-based layout for participants:
- Data table with columns: Address (truncated), Mint timestamp, Entry status
- Execute lottery button (destructive action, requires confirmation)
- Winner selection results display
- Only accessible to contract owner

### 6. Navigation
Minimal top nav:
- App logo/title (left)
- Wallet connection button (right, rounded-full, px-6)
- Network indicator badge (Base)

### 7. Notifications/Alerts
Toast-style notifications (fixed top-right):
- Task verification confirmations
- Transaction status updates
- Error messages
- Success celebrations (SBT minted, lottery entry confirmed)

---

## Interaction Patterns

**Task Flow**:
1. Locked appearance for incomplete tasks
2. Active button state for available tasks
3. Smooth transition to verified state (instant, no animation)
4. Enable next task only after previous verification

**Wallet Integration**:
- Persistent connection indicator
- Network warning if not on Base
- Transaction modal overlay for mint action

**Data Loading**:
- Skeleton loaders for stats (h-8 rounded bg-gray-200 animate-pulse)
- Spinner only for transaction pending states
- Instant updates post-verification (no artificial delays)

---

## Responsive Behavior

**Mobile (base)**:
- Single column task cards
- Stats grid: 2 columns
- Full-width buttons

**Desktop (md: and above)**:
- Same single column for tasks (focused flow)
- Stats grid: 4 columns
- Admin table: horizontal scroll if needed

---

## Key Design Principles

1. **Task Clarity**: Each step must be unmistakably clear - no guessing about status
2. **Blockchain Feedback**: Every on-chain action gets immediate UI feedback
3. **Anti-Cheat Transparency**: Show verification process clearly without exposing exploits
4. **Progressive Disclosure**: Show mint option only when eligible, admin only to owner
5. **Data Density**: Stats dashboard maximizes information without clutter

---

## Images

No decorative images required. This is a pure utility interface. Use:
- Iconography from Heroicons (outline style for inactive, solid for active states)
- No hero image
- Optional: Placeholder avatar/profile images for social task previews (64x64px, rounded-full)