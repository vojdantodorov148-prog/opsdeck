import type { TaskStatus, TestStatus, Department, ProductStatus } from '@/types/db'

export const TEST_STATUS_ORDER: TestStatus[] = [
  'not_tested', 'planned', 'preparing', 'ready', 'testing', 'winner', 'stopped',
]

export const TEST_STATUS: Record<TestStatus, { label: string; dot: string; cell: string; text: string }> = {
  not_tested: { label: 'Not tested', dot: '#C9D4D2', cell: 'bg-white',        text: 'text-ink-mute' },
  planned:    { label: 'Planned',    dot: '#7EA6C9', cell: 'bg-[#EEF4F9]',    text: 'text-[#3D6E9B]' },
  preparing:  { label: 'Preparing',  dot: '#D9A85B', cell: 'bg-[#FBF3E4]',    text: 'text-[#946A16]' },
  ready:      { label: 'Ready',      dot: '#8FBF8F', cell: 'bg-[#F0F7F0]',    text: 'text-[#4C7A4C]' },
  testing:    { label: 'Testing',    dot: '#0F9382', cell: 'bg-teal-50',      text: 'text-teal-700' },
  winner:     { label: 'Winner',     dot: '#3E8E5F', cell: 'bg-[#E7F4EC]',    text: 'text-[#2C6C46]' },
  stopped:    { label: 'Stopped',    dot: '#B08A8A', cell: 'bg-[#F7EFEF]',    text: 'text-[#8A5B5B]' },
}

export const TASK_STATUS: Record<TaskStatus, { label: string; className: string }> = {
  todo:    { label: 'To do',   className: 'bg-panel text-ink-soft border-line' },
  doing:   { label: 'Doing',   className: 'bg-teal-50 text-teal-700 border-teal-100' },
  blocked: { label: 'Blocked', className: 'bg-[#FBEFEA] text-[#A0522D] border-[#F0DCD2]' },
  review:  { label: 'Review',  className: 'bg-[#FBF3E4] text-[#946A16] border-[#F0E4CB]' },
  done:    { label: 'Done',    className: 'bg-[#E7F4EC] text-[#2C6C46] border-[#D3E9DB]' },
}

export const PRODUCT_STATUS: Record<ProductStatus, string> = {
  research: 'Research', approved: 'Approved', active: 'Active', paused: 'Paused', archived: 'Archived',
}

export const DEPARTMENT: Record<Department, { label: string; path: string }> = {
  landing:  { label: 'Landing',  path: '/landings' },
  creative: { label: 'Creative', path: '/creatives' },
  testing:  { label: 'Testing',  path: '/testing/products' },
  general:  { label: 'General',  path: '/tasks' },
}
