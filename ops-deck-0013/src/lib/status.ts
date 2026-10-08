import type { TaskStatus, TestStatus, Department, ProductStatus } from '@/types/db'

export const TEST_STATUS_ORDER: TestStatus[] = [
  'not_tested', 'planned', 'preparing', 'ready', 'testing', 'winner', 'stopped',
]

export const TEST_STATUS: Record<TestStatus, { label: string; dot: string; cell: string; text: string }> = {
  not_tested: { label: 'Не е тестиран', dot: '#C9D4D2', cell: 'bg-white', text: 'text-ink-mute' },
  planned: { label: 'Планиран', dot: '#7EA6C9', cell: 'bg-[#EEF4F9]', text: 'text-[#3D6E9B]' },
  preparing: { label: 'Во подготовка', dot: '#D9A85B', cell: 'bg-[#FBF3E4]', text: 'text-[#946A16]' },
  ready: { label: 'Подготвен', dot: '#8FBF8F', cell: 'bg-[#F0F7F0]', text: 'text-[#4C7A4C]' },
  testing: { label: 'Се тестира', dot: '#0F9382', cell: 'bg-teal-50', text: 'text-teal-700' },
  winner: { label: 'Победник', dot: '#3E8E5F', cell: 'bg-[#E7F4EC]', text: 'text-[#2C6C46]' },
  stopped: { label: 'Стопиран', dot: '#B08A8A', cell: 'bg-[#F7EFEF]', text: 'text-[#8A5B5B]' },
}

export const TASK_STATUS: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: 'За работа', className: 'bg-panel text-ink-soft border-line' },
  doing: { label: 'Во тек', className: 'bg-teal-50 text-teal-700 border-teal-100' },
  blocked: { label: 'Блокирано', className: 'bg-[#FBEFEA] text-[#A0522D] border-[#F0DCD2]' },
  review: { label: 'За преглед', className: 'bg-[#FBF3E4] text-[#946A16] border-[#F0E4CB]' },
  done: { label: 'Завршено', className: 'bg-[#E7F4EC] text-[#2C6C46] border-[#D3E9DB]' },
}

export const PRODUCT_STATUS: Record<ProductStatus, string> = {
  research: 'Истражување', approved: 'Одобрен', active: 'Активен', paused: 'Паузиран', archived: 'Архивиран',
}

export const DEPARTMENT: Record<Department, { label: string; path: string }> = {
  landing: { label: 'Лендинг', path: '/landings' },
  creative: { label: 'Креативи', path: '/creatives' },
  testing: { label: 'Тестирање', path: '/testing/products' },
  general: { label: 'Општо', path: '/tasks' },
}
