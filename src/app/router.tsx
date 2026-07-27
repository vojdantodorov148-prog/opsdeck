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
import { VisionCenter } from '@/features/vision/VisionCenter'
import { Settings } from '@/features/settings/Settings'
import { RequirePermission } from './guards'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'my-day', element: <MyDay /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'products', element: <Products /> },
      { path: 'products/:id', element: <ProductDetail /> },
      { path: 'landings', element: <Factory department="landing" /> },
      { path: 'creatives', element: <Factory department="creative" /> },
      { path: 'testing', element: <TestingHub /> },
      { path: 'testing/products', element: <ProductTesting /> },
      { path: 'tools', element: <Tools /> },
      { path: 'notes', element: <Notes /> },
      { path: 'team', element: <Team /> },
      {
        path: 'vision',
        element: <RequirePermission permission="vision_center.read"><VisionCenter /></RequirePermission>,
      },
      {
        path: 'settings',
        element: <RequirePermission permission="settings.manage"><Settings /></RequirePermission>,
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
