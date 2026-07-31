import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Home } from '@/features/home/Home'
import { MyDay } from '@/features/my-day/MyDay'
import { Tasks } from '@/features/tasks/Tasks'
import { Products } from '@/features/products/Products'
import { ProductDetail } from '@/features/products/ProductDetail'
import { Factory } from '@/features/factory/Factory'
import { TestingHub } from '@/features/testing/TestingHub'
import { ProductTesting } from '@/features/testing/ProductTesting'
import { Tools } from '@/features/tools/Tools'
import { Notes } from '@/features/notes/Notes'
import { Team } from '@/features/team/Team'
import { Settings } from '@/features/settings/Settings'
import { Finance } from '@/features/finance/Finance'
import { Brands } from '@/features/brands/Brands'
import { RequirePage, RequirePermission } from './guards'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RequirePage page="home"><Home /></RequirePage> },
      { path: 'my-day', element: <RequirePage page="my_day"><MyDay /></RequirePage> },
      { path: 'tasks', element: <RequirePage page="tasks"><Tasks /></RequirePage> },
      { path: 'products', element: <RequirePage page="products"><Products /></RequirePage> },
      { path: 'products/:id', element: <RequirePage page="products"><ProductDetail /></RequirePage> },
      { path: 'landings', element: <RequirePage page="landings"><Factory department="landing" /></RequirePage> },
      { path: 'creatives', element: <RequirePage page="creatives"><Factory department="creative" /></RequirePage> },
      { path: 'testing', element: <RequirePage page="testing"><TestingHub /></RequirePage> },
      { path: 'testing/products', element: <RequirePage page="testing"><ProductTesting /></RequirePage> },
      { path: 'finance', element: <RequirePage page="finance"><Finance /></RequirePage> },
      { path: 'brands', element: <RequirePage page="brands"><Brands /></RequirePage> },
      { path: 'tools', element: <RequirePage page="tools"><Tools /></RequirePage> },
      { path: 'notes', element: <RequirePage page="notes"><Notes /></RequirePage> },
      { path: 'team', element: <RequirePage page="team"><Team /></RequirePage> },
      {
        path: 'settings',
        element: <RequirePage page="settings"><RequirePermission permission="settings.manage"><Settings /></RequirePermission></RequirePage>,
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
