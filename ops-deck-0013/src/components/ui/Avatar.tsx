import { cn } from '@/lib/cn'

const TINTS = ['bg-teal-100 text-teal-700', 'bg-[#EEF4F9] text-[#3D6E9B]', 'bg-[#FBF3E4] text-[#946A16]', 'bg-[#E7F4EC] text-[#2C6C46]']

export function Avatar({ name, url, size = 28, className }: { name?: string | null; url?: string | null; size?: number; className?: string }) {
  const initials = (name ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  const tint = TINTS[(name?.length ?? 0) % TINTS.length]
  if (url) {
    return <img src={url} alt={name ?? ''} width={size} height={size} className={cn('rounded-full object-cover', className)} style={{ width: size, height: size }} />
  }
  return (
    <span
      className={cn('inline-grid place-items-center rounded-full font-semibold', tint, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
