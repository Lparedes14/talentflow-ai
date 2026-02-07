// src/app/page.tsx
// Landing page - Redirige al dashboard o muestra bienvenida




import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}