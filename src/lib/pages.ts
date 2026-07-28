export type PageKey =
  | 'home'
  | 'my_day'
  | 'tasks'
  | 'products'
  | 'landings'
  | 'creatives'
  | 'testing'
  | 'tools'
  | 'notes'
  | 'team'
  | 'settings'

export const APP_PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: 'home', label: 'Почетна', path: '/' },
  { key: 'my_day', label: 'Мој ден', path: '/my-day' },
  { key: 'tasks', label: 'Задачи', path: '/tasks' },
  { key: 'products', label: 'Производи', path: '/products' },
  { key: 'landings', label: 'Лендинг страници', path: '/landings' },
  { key: 'creatives', label: 'Креативи', path: '/creatives' },
  { key: 'testing', label: 'Тестирање', path: '/testing' },
  { key: 'tools', label: 'Алатки', path: '/tools' },
  { key: 'notes', label: 'Белешки', path: '/notes' },
  { key: 'team', label: 'Тим', path: '/team' },
  { key: 'settings', label: 'Поставки', path: '/settings' },
]

export const DEFAULT_MEMBER_PAGES: PageKey[] = [
  'home', 'my_day', 'tasks', 'products', 'landings', 'creatives', 'testing', 'tools', 'notes', 'team',
]
